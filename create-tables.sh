#!/bin/bash
set -e

echo "Creating contact_messages..."
aws dynamodb create-table \
  --table-name contact_messages \
  --attribute-definitions \
    AttributeName=messageId,AttributeType=S \
    AttributeName=threadId,AttributeType=S \
    AttributeName=receivedAt,AttributeType=S \
  --key-schema AttributeName=messageId,KeyType=HASH \
  --global-secondary-indexes \
    "[{\"IndexName\":\"threadId-index\",\"KeySchema\":[{\"AttributeName\":\"threadId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"receivedAt\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --billing-mode PAY_PER_REQUEST \
  --profile sixspur --region us-east-1

echo "Creating adoptable_animals..."
aws dynamodb create-table \
  --table-name adoptable_animals \
  --attribute-definitions \
    AttributeName=animalId,AttributeType=S \
    AttributeName=status,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
  --key-schema AttributeName=animalId,KeyType=HASH \
  --global-secondary-indexes \
    "[{\"IndexName\":\"status-index\",\"KeySchema\":[{\"AttributeName\":\"status\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"createdAt\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --billing-mode PAY_PER_REQUEST \
  --profile sixspur --region us-east-1

echo "Creating farm_animals..."
aws dynamodb create-table \
  --table-name farm_animals \
  --attribute-definitions \
    AttributeName=animalId,AttributeType=S \
    AttributeName=species,AttributeType=S \
    AttributeName=displayOrder,AttributeType=N \
  --key-schema AttributeName=animalId,KeyType=HASH \
  --global-secondary-indexes \
    "[{\"IndexName\":\"species-index\",\"KeySchema\":[{\"AttributeName\":\"species\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"displayOrder\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --billing-mode PAY_PER_REQUEST \
  --profile sixspur --region us-east-1

echo "Creating subscribers..."
aws dynamodb create-table \
  --table-name subscribers \
  --attribute-definitions AttributeName=email,AttributeType=S \
  --key-schema AttributeName=email,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --profile sixspur --region us-east-1

echo "Creating news_posts..."
aws dynamodb create-table \
  --table-name news_posts \
  --attribute-definitions \
    AttributeName=slug,AttributeType=S \
    AttributeName=category,AttributeType=S \
    AttributeName=publishedAt,AttributeType=S \
    AttributeName=isPublished,AttributeType=S \
  --key-schema AttributeName=slug,KeyType=HASH \
  --global-secondary-indexes \
    "[{\"IndexName\":\"category-index\",\"KeySchema\":[{\"AttributeName\":\"category\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"publishedAt\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}},{\"IndexName\":\"published-index\",\"KeySchema\":[{\"AttributeName\":\"isPublished\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"publishedAt\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --billing-mode PAY_PER_REQUEST \
  --profile sixspur --region us-east-1

echo "All 5 tables created."
