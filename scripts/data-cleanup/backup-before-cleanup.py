#!/usr/bin/env python3
"""
Six Spur data cleanup - PHASE 1: BACKUP
Dumps all DynamoDB items and syncs all S3 objects that are about to be
deleted, to a local timestamped folder. Run this BEFORE run-data-cleanup.py.
Read-only against AWS -- safe to run as many times as you want.
"""
import subprocess
import json
import os
import sys
from datetime import datetime

PROFILE = "sixspur"
REGION = "us-east-1"

TABLES = [
    "shop_items",
    "orders",
    "donations",
    "recurring_donations",
    "fundraisers",
    "adoptable_animals",
    "adoption_applications",
    "news_posts",
    "contact_messages",
]

# (bucket, prefix, local_subfolder_name, exclude_pattern_or_None)
S3_TARGETS = [
    ("sixspurranch-assets", "images/adoptable/", "assets-images-adoptable", None),
    ("sixspurranch-assets", "images/shop/", "assets-images-shop", None),
    ("sixspurranch-assets", "documents/receipts/", "assets-documents-receipts", None),
    ("sixspurranch-assets", "newsletter-uploads/", "assets-newsletter-uploads", None),
    ("sixspurranch-assets", "social-uploads/", "assets-social-uploads", None),
    ("sixspurranch-adoption-pdfs", "", "adoption-pdfs", None),
    ("sixspurranch-adoption-uploads", "", "adoption-uploads", None),
    ("sixspurranch-incoming-mail", "", "incoming-mail", "AMAZON_SES_SETUP_NOTIFICATION"),
]

BACKUP_ROOT = os.path.expanduser(
    f"~/Desktop/sixspur-cleanup-backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
)


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ERROR running: {' '.join(cmd)}")
        print(f"  {result.stderr.strip()}")
        sys.exit(1)
    return result.stdout


def scan_all_items(table):
    items = []
    start_key = None
    while True:
        cmd = [
            "aws", "dynamodb", "scan",
            "--table-name", table,
            "--region", REGION,
            "--profile", PROFILE,
            "--output", "json",
        ]
        if start_key:
            cmd += ["--exclusive-start-key", json.dumps(start_key)]
        out = json.loads(run(cmd))
        items.extend(out.get("Items", []))
        start_key = out.get("LastEvaluatedKey")
        if not start_key:
            break
    return items


def main():
    os.makedirs(BACKUP_ROOT, exist_ok=True)
    dynamo_dir = os.path.join(BACKUP_ROOT, "dynamodb")
    s3_dir = os.path.join(BACKUP_ROOT, "s3")
    os.makedirs(dynamo_dir, exist_ok=True)
    os.makedirs(s3_dir, exist_ok=True)

    print(f"Backup folder: {BACKUP_ROOT}\n")

    print("=== Backing up DynamoDB tables ===")
    for table in TABLES:
        print(f"  {table} ... ", end="", flush=True)
        items = scan_all_items(table)
        out_path = os.path.join(dynamo_dir, f"{table}.json")
        with open(out_path, "w") as f:
            json.dump(items, f, indent=2)
        print(f"{len(items)} items -> {out_path}")

    print("\n=== Backing up S3 objects ===")
    for bucket, prefix, local_name, exclude in S3_TARGETS:
        local_path = os.path.join(s3_dir, local_name)
        os.makedirs(local_path, exist_ok=True)
        s3_uri = f"s3://{bucket}/{prefix}"
        cmd = ["aws", "s3", "sync", s3_uri, local_path, "--profile", PROFILE]
        if exclude:
            cmd += ["--exclude", exclude]
        print(f"  {s3_uri} -> {local_path}")
        run(cmd)

    print("\n=== Backup complete ===")
    print(f"Everything is saved at: {BACKUP_ROOT}")
    print("Next: run run-data-cleanup.py with this same backup folder path.")
    print(f"\n  python3 run-data-cleanup.py \"{BACKUP_ROOT}\"")


if __name__ == "__main__":
    main()
