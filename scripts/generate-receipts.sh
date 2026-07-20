#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="public/receipts"
mkdir -p "$OUTPUT_DIR"

make_receipt() {
  local filename="$1"
  local status="$2"
  local reference="$3"
  local amount="$4"
  local start_date="$5"
  local end_date="$6"
  local accent="$7"

  magick -size 1000x1240 xc:'#F7F4EA' \
    -fill '#171816' -draw 'roundrectangle 42,42 958,1198 34,34' \
    -fill '#FFFDF7' -draw 'roundrectangle 46,46 954,1194 31,31' \
    -fill "$accent" -draw 'roundrectangle 88,92 912,232 24,24' \
    -font '/System/Library/Fonts/Supplemental/Arial Bold.ttf' -fill '#171816' -pointsize 26 \
    -draw "text 122,148 'DEMO RECEIPT'" \
    -font '/System/Library/Fonts/Supplemental/Arial.ttf' -pointsize 20 -draw "text 122,190 'NOT A REAL PURCHASE'" \
    -font '/System/Library/Fonts/Supplemental/Arial Bold.ttf' -pointsize 48 -draw "text 88,340 'Plus — mobile billed demo'" \
    -font '/System/Library/Fonts/Supplemental/Arial.ttf' -fill '#63665E' -pointsize 23 \
    -draw "text 88,390 'Synthetic mobile-store provider fixture'" \
    -stroke '#D8D5C9' -strokewidth 2 -draw 'line 88,448 912,448' \
    -stroke none -font '/System/Library/Fonts/Supplemental/Arial.ttf' -fill '#63665E' -pointsize 22 \
    -draw "text 88,520 'AMOUNT PAID'" \
    -draw "text 88,654 'PAID PERIOD START'" \
    -draw "text 88,788 'PAID PERIOD END'" \
    -draw "text 88,922 'PROVIDER STATUS'" \
    -font '/System/Library/Fonts/Supplemental/Arial Bold.ttf' -fill '#171816' -pointsize 42 \
    -draw "text 88,574 '$amount'" \
    -pointsize 31 -draw "text 88,708 '$start_date'" \
    -draw "text 88,842 '$end_date'" \
    -fill "$accent" -draw 'roundrectangle 88,954 465,1032 18,18' \
    -font '/System/Library/Fonts/Supplemental/Arial Bold.ttf' -fill '#171816' -pointsize 26 \
    -draw "text 116,1004 '$status'" \
    -font '/System/Library/Fonts/Supplemental/Courier New.ttf' -fill '#63665E' -pointsize 20 \
    -draw "text 88,1112 'REFERENCE  $reference'" \
    -font '/System/Library/Fonts/Supplemental/Arial.ttf' -pointsize 17 \
    -draw "text 88,1158 'Synthetic fixture • Safe for public demo use'" \
    -strip "$OUTPUT_DIR/$filename.png"
}

make_receipt 'receipt-active-normal' 'ACTIVE' 'TMM-ACTIVE-001' 'EUR 24.99' '07 JUL 2026' '07 AUG 2026' '#BDFB62'
make_receipt 'receipt-one-day-left' 'ACTIVE · 1 DAY LEFT' 'TMM-ONE-DAY-001' 'EUR 24.99' '01 JUL 2026' '01 AUG 2026' '#D9F99D'
make_receipt 'receipt-expired' 'EXPIRED' 'TMM-EXPIRED-001' 'EUR 24.99' '01 JUN 2026' '01 JUL 2026' '#E5E1D5'
make_receipt 'receipt-refunded' 'REFUNDED' 'TMM-REFUNDED-001' 'EUR 24.99' '07 JUL 2026' '07 AUG 2026' '#FFB4A8'
make_receipt 'receipt-already-migrated' 'ACTIVE · USED' 'TMM-CONSUMED-001' 'EUR 24.99' '07 JUL 2026' '07 AUG 2026' '#FFD7A3'
make_receipt 'receipt-billing-retry' 'BILLING RETRY' 'TMM-RETRY-001' 'EUR 24.99' '07 JUL 2026' '07 AUG 2026' '#FFE08A'
make_receipt 'receipt-credit-exceeds-target' 'ACTIVE' 'TMM-EXCESS-001' 'EUR 49.99' '07 JUL 2026' '07 AUG 2026' '#BDFB62'
make_receipt 'receipt-ai-unavailable' 'ACTIVE · AI OFFLINE' 'TMM-AI-OFFLINE-001' 'EUR 24.99' '07 JUL 2026' '07 AUG 2026' '#C8D7FF'
make_receipt 'receipt-unknown-result' 'ACTIVE' 'TMM-UNKNOWN-001' 'EUR 24.99' '07 JUL 2026' '07 AUG 2026' '#BDFB62'
