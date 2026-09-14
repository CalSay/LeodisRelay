# RELAY report naming and SharePoint storage

## Record model

- A submitted site report revision is the only document RELAY renders as a PDF.
- Defect and access cards become Issue Tracker records when the report is sent.
- Variation cards become Variation Register records when the report is sent.
- Issues and variations link to their source report and its filed PDF. They do not create duplicate PDFs.
- A correction is a new immutable report revision. The original file remains in place and is marked superseded in the Report Register.

## Filename

Every surface uses the same readable filename:

`011LME - SPR-009 - 2026-09-14 - Rev 1.pdf`

The parts are the project number, report sequence, ISO visit date and revision. Test records retain a leading `DEMO-` marker. Internal RELAY UUIDs are deliberately excluded from filenames; they remain stored in the registers for idempotency and reconciliation.

## Folder

Each project's configured Reports folder contains one year folder:

```text
Reports/
  2026/
    011LME - SPR-009 - 2026-09-14 - Rev 1.pdf
    011LME - SPR-009 - 2026-09-14 - Rev 2.pdf
  2027/
```

RELAY creates the four-digit year folder only beneath the already verified project Reports folder. It never guesses a project folder.

## Existing files

Existing successful filing receipts always win. RELAY reopens and verifies that exact SharePoint item without moving or renaming it. If an older filing exists under the former UUID filename but its receipt was lost, RELAY verifies and adopts it in place. Only a genuinely new filing receives the new name and year folder.

## Register links

- Report Register: filed PDF link and immutable RELAY report identity.
- Issue Tracker: source report ID, RELAY issue link and filed source-report evidence link.
- Variation Register: source report ID, RELAY variation link and filed source-report evidence link.

SharePoint lists and their views are the index. PDFs are not copied into Defect or Variation folders.
