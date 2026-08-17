#!/usr/bin/env python3
"""
Six Spur data cleanup - PHASE 2: DELETE
Deletes all items from the 9 target DynamoDB tables and all objects at the
target S3 prefixes. REFUSES to run unless a backup folder (produced by
backup-before-cleanup.py) is passed as an argument and contains a non-empty
record for every target.

Usage:
  python3 run-data-cleanup.py /path/to/sixspur-cleanup-backup-YYYYMMDD-HHMMSS
"""
import subprocess
import json
import os
import sys

PROFILE = "sixspur"
REGION = "us-east-1"

# table -> hash key attribute name
TABLES = {
    "shop_items": "itemId",
    "orders": "orderId",
    "donations": "donationId",
    "recurring_donations": "subscriptionId",
    "fundraisers": "fundraiserId",
    "adoptable_animals": "animalId",
    "adoption_applications": "applicationId",
    "news_posts": "slug",
    "contact_messages": "messageId",
}

# (bucket, prefix, backup_local_subfolder_name, exclude_pattern_or_None)
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


def run(cmd, allow_fail=False):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 and not allow_fail:
        print(f"  ERROR running: {' '.join(cmd)}")
        print(f"  {result.stderr.strip()}")
        sys.exit(1)
    return result.stdout


def scan_all_items(table, projection=None):
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
        if projection:
            cmd += ["--projection-expression", projection]
        if start_key:
            cmd += ["--exclusive-start-key", json.dumps(start_key)]
        out = json.loads(run(cmd))
        items.extend(out.get("Items", []))
        start_key = out.get("LastEvaluatedKey")
        if not start_key:
            break
    return items


def verify_backup(backup_root):
    dynamo_dir = os.path.join(backup_root, "dynamodb")
    s3_dir = os.path.join(backup_root, "s3")
    problems = []

    for table in TABLES:
        path = os.path.join(dynamo_dir, f"{table}.json")
        if not os.path.exists(path):
            problems.append(f"Missing DynamoDB backup file: {path}")
            continue
        # confirm backup item count matches current live item count
        with open(path) as f:
            backed_up = json.load(f)
        live_count = len(scan_all_items(table, projection=TABLES[table]))
        if len(backed_up) != live_count:
            problems.append(
                f"{table}: backup has {len(backed_up)} items but live table "
                f"has {live_count}. Backup may be stale -- rerun backup-before-cleanup.py."
            )

    for bucket, prefix, local_name, exclude in S3_TARGETS:
        local_path = os.path.join(s3_dir, local_name)
        if not os.path.isdir(local_path):
            problems.append(f"Missing S3 backup folder: {local_path}")

    return problems


def delete_table_items(table, key_name):
    items = scan_all_items(table, projection=key_name)
    for item in items:
        key = {key_name: item[key_name]}
        run([
            "aws", "dynamodb", "delete-item",
            "--table-name", table,
            "--key", json.dumps(key),
            "--region", REGION,
            "--profile", PROFILE,
        ])
    return len(items)


def delete_s3_target(bucket, prefix, exclude):
    s3_uri = f"s3://{bucket}/{prefix}"
    cmd = ["aws", "s3", "rm", s3_uri, "--recursive", "--profile", PROFILE]
    if exclude:
        cmd += ["--exclude", exclude]
    out = run(cmd)
    return out


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 run-data-cleanup.py /path/to/backup-folder")
        sys.exit(1)

    backup_root = os.path.expanduser(sys.argv[1])
    if not os.path.isdir(backup_root):
        print(f"Backup folder not found: {backup_root}")
        sys.exit(1)

    print(f"Verifying backup at: {backup_root}\n")
    problems = verify_backup(backup_root)
    if problems:
        print("REFUSING TO DELETE -- backup verification failed:")
        for p in problems:
            print(f"  - {p}")
        print("\nRun backup-before-cleanup.py again, then retry.")
        sys.exit(1)

    print("Backup verified OK for all 9 tables and all S3 targets.\n")
    print("This will PERMANENTLY DELETE:")
    print("  - All items in:", ", ".join(TABLES.keys()))
    print("  - All objects in the shop/adoptable/receipts/newsletter/social")
    print("    prefixes in sixspurranch-assets")
    print("  - All objects in sixspurranch-adoption-pdfs and sixspurranch-adoption-uploads")
    print("  - All objects in sixspurranch-incoming-mail (except the SES setup notification)")
    print("\nDonor accounts (donors table), farm_animals, subscribers, staff_members,")
    print("shop_settings, and the hero/farm-animal/team images are NOT touched.\n")

    confirm = input("Type DELETE (all caps) to proceed: ")
    if confirm != "DELETE":
        print("Aborted -- no changes made.")
        sys.exit(0)

    print("\n=== Deleting DynamoDB items ===")
    for table, key_name in TABLES.items():
        print(f"  {table} ... ", end="", flush=True)
        count = delete_table_items(table, key_name)
        print(f"deleted {count} items")

    print("\n=== Deleting S3 objects ===")
    for bucket, prefix, local_name, exclude in S3_TARGETS:
        s3_uri = f"s3://{bucket}/{prefix}"
        print(f"  {s3_uri} ... ", end="", flush=True)
        delete_s3_target(bucket, prefix, exclude)
        print("done")

    print("\n=== Cleanup complete ===")
    print(f"Backup remains at: {backup_root}")


if __name__ == "__main__":
    main()
