# Image Resizer & Optimizer

A standalone, responsive image-processing app. It runs locally in the browser; images are not uploaded to a server.

## Use
1. Open `index.html` in a modern browser.
2. Choose or drag in a PNG, JPG, or WebP image.
3. Set dimensions, aspect ratio, output format, target KB range, fitting method, and quality.
4. Click **Process image**, then download the result.

## Share with others
- Quick sharing: send them `index.html`; they can open it in a modern browser.
- Shareable URL: upload `index.html` as `index.html` to a static host such as GitHub Pages, Netlify, or Cloudflare Pages, then share the published URL.
- No backend or account is required for image processing.

## Notes
- Smart crop fills the requested canvas using a centered crop and can trim edges.
- Contain/extend preserve the full image and use white padding when aspect ratios differ.
- WebP/JPG quality is adjusted to try to fit the requested maximum file size.
- PNG is lossless, so its size cannot be guaranteed to fit a target KB range.
- Resizing preserves existing pixels as closely as possible; it cannot recover detail missing from a low-resolution source.
