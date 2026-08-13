# Label Generator

Make printable labels for things around the house — jars, zip bags, shelves,
price tags. Type the text, pick a size in centimetres, and download a single A4
page filled with as many copies as fit.

## Screenshot

Not captured yet. To add one: run the app locally, open
<http://localhost:3000>, save the page as `docs/screenshot.png`, and replace this
section with

```md
![The label generator web page](docs/screenshot.png)
```

## What it does

- One page, one form: label text, size in cm, font, text size, alignment
  (horizontal and vertical), border stroke width and corner radius.
- A live preview that measures text with the very same font file the PDF is
  built from, so what you see is what gets printed.
- Auto-fills an A4 page with the label and tells you how many fit
  (`24 per A4 page (4 x 6)`).
- Six bundled fonts — two sans, two serif, two monospace — each with a bold
  variant and full Latin + Cyrillic coverage, so Ukrainian text prints correctly.
- **Download the calibration PDF**: one 10 × 10 cm square centred on A4. Print it
  at 100% scale and measure it. If it is not exactly 10 cm, your printer is
  resizing the page and every label will come out wrong.

Labels are always pure black on white — deliberately not configurable.

## Running it locally

Requires Node 22 and Docker (for MongoDB).

```sh
docker compose up -d          # MongoDB on localhost:27017
cp .env.example .env
npm install
npm run dev                   # http://localhost:3000
```

MongoDB runs as a plain standalone server — no replica set needed. Generated
PDFs are stored in GridFS, so a download link keeps working after the fact.

There is also a devcontainer: open the folder in VS Code and choose **Reopen in
Container**. It brings up the app container and MongoDB together and runs
`npm install` for you.

## Deployment

Pushing to `main` builds a Docker image, publishes it to
`ghcr.io/vovastelmashchuk/label-generator`, and deploys `docker-stack.yml` to the
VPS over SSH.

The workflow expects these repository settings:

| Kind     | Name                   | Purpose                            |
| -------- | ---------------------- | ---------------------------------- |
| Variable | `HOST`                 | VPS hostname                       |
| Variable | `USERNAME`             | SSH user                           |
| Secret   | `ROOT_SSH_PRIVATE_KEY` | SSH key for that user              |
| Secret   | `MONGO_URI`            | Connection string used in production |

The service joins the external `infra_reverse-proxy` network and answers a
healthcheck on `/api/health`.
