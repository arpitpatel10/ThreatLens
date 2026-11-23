"""Download the current CISA Known Exploited Vulnerabilities (KEV) catalog
and convert the newest records into a ThreatLens-compatible CSV.

Run: python download_live_threatlens_data.py
Output: threatlens_live_cisa_kev.csv
Source: https://www.cisa.gov/known-exploited-vulnerabilities-catalog
"""
import csv
import json
import urllib.request
from datetime import datetime, timezone

FEED_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
OUTPUT_FILE = "threatlens_live_cisa_kev.csv"
LATEST_RECORDS = 100  # Change this to None to export the full catalog.

request = urllib.request.Request(
    FEED_URL,
    headers={"User-Agent": "ThreatLens-Student-Research/1.0"},
)
with urllib.request.urlopen(request, timeout=30) as response:
    catalog = json.load(response)

records = catalog.get("vulnerabilities", [])
records.sort(key=lambda item: item.get("dateAdded", ""), reverse=True)
if LATEST_RECORDS:
    records = records[:LATEST_RECORDS]

fields = [
    "text", "cveID", "vendorProject", "product", "vulnerabilityName",
    "dateAdded", "dueDate", "knownRansomwareCampaignUse", "requiredAction",
    "source", "catalogVersion", "feedReleasedAt", "retrievedAtUTC",
]
retrieved_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

with open(OUTPUT_FILE, "w", newline="", encoding="utf-8-sig") as csvfile:
    writer = csv.DictWriter(csvfile, fieldnames=fields)
    writer.writeheader()
    for item in records:
        # The required 'text' column contains the natural-language CTI description.
        text = " | ".join(part for part in [
            item.get("cveID", ""),
            item.get("vulnerabilityName", ""),
            f"Vendor: {item.get('vendorProject', '')}",
            f"Product: {item.get('product', '')}",
            item.get("shortDescription", ""),
            f"Required action: {item.get('requiredAction', '')}",
            f"Known ransomware campaign use: {item.get('knownRansomwareCampaignUse', '')}",
        ] if part)
        writer.writerow({
            "text": text,
            "cveID": item.get("cveID", ""),
            "vendorProject": item.get("vendorProject", ""),
            "product": item.get("product", ""),
            "vulnerabilityName": item.get("vulnerabilityName", ""),
            "dateAdded": item.get("dateAdded", ""),
            "dueDate": item.get("dueDate", ""),
            "knownRansomwareCampaignUse": item.get("knownRansomwareCampaignUse", ""),
            "requiredAction": item.get("requiredAction", ""),
            "source": "CISA Known Exploited Vulnerabilities Catalog",
            "catalogVersion": catalog.get("catalogVersion", ""),
            "feedReleasedAt": catalog.get("dateReleased", ""),
            "retrievedAtUTC": retrieved_at,
        })

print(f"Downloaded {len(records)} current CISA KEV records")
print(f"Catalog version: {catalog.get('catalogVersion', 'not provided')}")
print(f"Feed release date: {catalog.get('dateReleased', 'not provided')}")
print(f"Saved: {OUTPUT_FILE}")
print("Upload this CSV to ThreatLens. The required 'text' column is included.")
print("Note: CISA KEV is vulnerability intelligence, not a balanced labeled training dataset.")
