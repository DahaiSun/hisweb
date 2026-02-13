# Archive.org Data Source

## Website
- Internet Archive: https://archive.org/
- Developer Portal: https://archive.org/services/docs/api/

## Why This Helps
- Use as a primary-source archive for financial history evidence.
- Useful for historical documents, web snapshots, TV/news archives, and media references.
- Best used as a source layer, not as the final event timeline.

## Recommended Usage For This Project
1. Keep your own event database as the source of truth.
2. Attach 2-3 Archive.org references per event (documents, snapshots, media).
3. Use Wayback snapshots to capture institutional pages around key dates.
4. Keep citation metadata: URL, timestamp, collection, confidence notes.

## API Endpoints (Examples)
- Advanced Search:
  - https://archive.org/advancedsearch.php?q=mediatype:texts&fl[]=identifier&rows=0&page=1&output=json
- Wayback availability:
  - https://archive.org/wayback/available?url=www.wsj.com&timestamp=20080915
- TV News collection query:
  - https://archive.org/advancedsearch.php?q=collection:tvnews&fl[]=identifier&rows=0&output=json

## Caveats
- Metadata quality varies; duplicates/noise are common.
- OCR quality can be inconsistent.
- Licensing and reuse rights must be checked per item.
