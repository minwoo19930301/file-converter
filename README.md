# File Converter

Browser-based file converter built with Next.js and deployed on Vercel.

Live URL: https://file-converter-indol.vercel.app

## Features

- Convert `PNG`, `JPG`, and `WEBP` images into `PDF`
- Convert images between `PNG`, `JPG`, and `WEBP`
- Convert `PDF` files into page-by-page image exports
- Convert `TXT` files into `PDF`
- Convert `TXT` files into `Word (.docx)`
- Download multi-page PDF exports as a ZIP archive
- Process files in the browser without uploading them to a server

## Supported Inputs and Outputs

- `PNG` / `JPG` / `WEBP` -> `PDF`, `PNG`, `JPG`, `WEBP`
- `PDF` -> `PNG`, `JPG`, `WEBP`
- `TXT` -> `PDF`, `DOCX`

## Tech Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- `docx`
- `pdf-lib`
- `pdfjs-dist`
- `jszip`
- Vercel

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production

This project is hosted on Vercel:

- Production URL: https://file-converter-indol.vercel.app
- Vercel Project: `file-converter`

## Notes

- `PDF -> image` exports each page separately.
- Multi-page PDF exports are bundled as a ZIP file.
- `TXT -> PDF` is rendered client-side using browser fonts.
- `TXT -> HWP` is not supported in this version.
- The current UI supports a single uploaded source file at a time.
