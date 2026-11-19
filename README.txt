Image Resizer & Optimizer

Deploy:
1. Upload index.html to the root of your GitHub repository.
2. Commit the change to the main branch.
3. If GitHub Pages is enabled for main / (root), wait for the deployment to finish.
4. Refresh the published site. If the old version remains, do a hard refresh (Ctrl+F5).

Image fitting methods:
- Smart crop: fills the target canvas and may crop outer edges.
- Contain: preserves the complete image with neutral padding where needed.
- Extend background: default. Places the complete original image over a blurred, enlarged backdrop.

All processing is performed locally in the browser. No image is uploaded to a server.
Note: Extend background uses a blurred enlargement of the original image, not AI-generated outpainting.
