"""
LUSTBOING — xHamster MILF Video Scraper
Searches for specific pornstars from PORNSTAR_DB,
extracts metadata, matches categories, and saves to Firestore.
"""

import os
import sys
import re
import time
import io
import requests
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# ── Firebase Setup ──────────────────────────────────────────────────────────
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lustboing-firebase-adminsdk-fbsvc-75a875842e.json")

if not os.path.exists(SERVICE_ACCOUNT_PATH):
    print(f"[ERROR] Service account key not found: {SERVICE_ACCOUNT_PATH}")
    sys.exit(1)

cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
firebase_admin.initialize_app(cred)
db = firestore.client()

# ── Pornstar DB (same as app.js) ───────────────────────────────────────────
PORNSTAR_DB = [
    "Eva Notty", "Ava Addams", "Leigh Darby", "Natasha Nice", "Raegan Foxx",
    "Angela White", "Sara Jay", "YinyLeon", "Kendra Lust", "Lisa Ann",
    "Siri Dahl", "Brandi Love", "Lauren Phillips", "Rose Monroe", "Violet Myers",
    "Sophie Dee", "Alison Tyler", "Phoenix Marie", "Bridgette B", "Julia Ann",
    "Ariella Ferrera", "Dee Williams", "Hitomi Tanaka", "Alura Jenson",
    "Gianna Michaels", "Romi Rain", "Britney Amber", "Brooklyn Chase",
]

# ── Category Keywords ───────────────────────────────────────────────────────
CATEGORY_KEYWORDS = {
    "Mature MILF": ["mature", "milf", "older"],
    "Cougar": ["cougar"],
    "Amateur MILF": ["amateur"],
    "Step Mom": ["step mom", "stepmom"],
    "BBW MILF": ["bbw"],
    "MILF Threesome": ["threesome", "3some"],
    "Big Tits MILF": ["big tits"],
    "Latina MILF": ["latina"],
    "Asian MILF": ["asian"],
    "Ebony MILF": ["ebony"],
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# ── Helpers ─────────────────────────────────────────────────────────────────
def extract_video_id(href):
    m = re.search(r'-(xh[a-zA-Z0-9]+)$', href)
    return m.group(1) if m else None

def match_category(tags, title):
    all_text = (title + " " + " ".join(tags)).lower()
    for cat_name, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in all_text:
                return cat_name
    return None

def search_xhamster(query, page=1):
    url = f"https://xhamster.com/search/{query}?page={page}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        if resp.status_code != 200:
            print(f"  [WARN] Search returned {resp.status_code}")
            return []
        soup = BeautifulSoup(resp.text, "html.parser")
        results = []
        seen_ids = set()

        for a in soup.find_all("a", href=re.compile(r"/videos/")):
            href = a.get("href", "")
            vid_id = extract_video_id(href)
            if not vid_id or vid_id in seen_ids:
                continue
            seen_ids.add(vid_id)

            title = a.get("title", "")
            if not title:
                slug = re.search(r'/videos/(.+?)-xh', href)
                if slug:
                    title = slug.group(1).replace("-", " ").title()

            img = a.find("img")
            thumb = ""
            if img:
                thumb = img.get("src", "") or img.get("data-src", "") or ""
                if not thumb:
                    srcset = img.get("srcset", "")
                    if srcset:
                        thumb = srcset.split(",")[0].strip().split(" ")[0]

            results.append({
                "id": vid_id,
                "url": href if href.startswith("http") else f"https://xhamster.com{href}",
                "title": title,
                "thumb": thumb,
            })

        return results
    except Exception as e:
        print(f"  [ERROR] Search failed: {e}")
        return []

def fetch_video_details(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        if resp.status_code != 200:
            return {}
        soup = BeautifulSoup(resp.text, "html.parser")
        details = {}

        og_title = soup.find("meta", property="og:title")
        if og_title:
            details["title"] = og_title.get("content", "")

        og_image = soup.find("meta", property="og:image")
        if og_image:
            details["thumbnail"] = og_image.get("content", "")

        dur_el = soup.select_one("span[data-testid='video-duration'], .video-duration, span.duration")
        if dur_el:
            details["duration"] = dur_el.get_text(strip=True)

        views_el = soup.select_one("span[data-testid='video-views'], .video-info .views")
        if views_el:
            raw = views_el.get_text(strip=True).replace(",", "")
            details["views"] = raw

        categories = []
        for a in soup.select("a[href*='/categories/']"):
            name = a.get_text(strip=True)
            if name:
                categories.append(name)
        details["categories"] = categories

        tags = []
        for a in soup.select("a[href*='/tags/']"):
            name = a.get_text(strip=True)
            if name:
                tags.append(name)
        details["tags"] = tags

        return details
    except Exception as e:
        print(f"    [WARN] Detail fetch failed: {e}")
        return {}

# ── Main Scraper ────────────────────────────────────────────────────────────
def scrape_videos(pornstar_limit=10):
    """Search for each pornstar by name and add their videos."""
    added = 0
    skipped = 0

    for pornstar_name in PORNSTAR_DB:
        print(f"\n[STAR] Searching: {pornstar_name}")
        results = search_xhamster(pornstar_name, page=1)
        print(f"  Found {len(results)} videos")

        pornstar_added = 0
        for vid in results:
            if pornstar_added >= pornstar_limit:
                break

            vid_id = vid["id"]

            # Check Firestore duplicate
            existing = db.collection("videos").where("videoId", "==", vid_id).limit(1).get()
            if list(existing):
                print(f"  [{vid_id}] SKIP - already in DB")
                skipped += 1
                continue

            print(f"  [{vid_id}] Fetching details...")
            details = fetch_video_details(vid["url"])
            time.sleep(1.5)

            title = details.get("title") or vid["title"] or "Untitled"
            thumbnail = details.get("thumbnail") or vid["thumb"] or ""
            duration = details.get("duration", "--:--")
            views = details.get("views", "--")
            categories = details.get("categories", [])
            tags = details.get("tags", [])

            category = match_category(tags + categories, title)

            # Build tags
            if "milf" not in [t.lower() for t in tags]:
                tags.insert(0, "milf")
            if pornstar_name.lower() not in [t.lower() for t in tags]:
                tags.append(pornstar_name.lower())
            if category and category.lower() not in [t.lower() for t in tags]:
                tags.append(category.lower())

            video_doc = {
                "platform": "xhamster",
                "videoId": vid_id,
                "videoUrl": vid["url"],
                "title": title,
                "duration": duration,
                "views": views,
                "tags": tags,
                "pornstar": pornstar_name,
                "category": category,
                "thumbUrl": thumbnail,
                "userId": "scraper",
                "addedAt": firestore.SERVER_TIMESTAMP,
            }

            try:
                db.collection("videos").add(video_doc)
                added += 1
                pornstar_added += 1
                print(f"  [{vid_id}] ADDED: {title[:55]}")
                print(f"         Pornstar: {pornstar_name} | Category: {category or 'none'}")
            except Exception as e:
                print(f"  [{vid_id}] ERROR: {e}")
                skipped += 1

            time.sleep(1)

        print(f"  -> {pornstar_name}: {pornstar_added} videos added")

    print(f"\n{'='*50}")
    print(f"DONE | Added: {added} | Skipped: {skipped}")
    print(f"{'='*50}")

# ── Entry Point ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    print(f"LUSTBOING Scraper - Fetching up to {limit} videos per pornstar\n")
    scrape_videos(pornstar_limit=limit)
