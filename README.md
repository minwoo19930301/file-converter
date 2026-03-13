# File Converter

Browser-based file converter built with Next.js and deployed on Vercel.

Live URL: https://file-converter-indol.vercel.app

## Features

- Convert `PNG`, `JPG`, `WEBP` images into `PDF`
- Convert images between `PNG`, `JPG`, and `WEBP`
- Convert `PDF` files into page-by-page image exports
- Download multi-page PDF conversions as a ZIP archive
- Process files in the browser without uploading them to a server

## Tech Stack

- Next.js 16
- React 19
- Tailwind CSS 4
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
- The current UI supports a single uploaded source file at a time.
