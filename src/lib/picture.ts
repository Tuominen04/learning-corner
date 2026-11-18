// A picture as a file: SVG text to the bytes a PNG holds.
//
// The interface draws; the shell only writes what it is handed (`shell.savePicture`). An SVG
// goes as it is. A PNG is the same SVG drawn onto a canvas, which is what the webview can do
// and the engine cannot — it has no fonts and no layout, and a second drawing in Rust would
// have to agree with this one.

/** `text`'s bytes in base64, whatever alphabet it is in. */
export function base64(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * An SVG drawn onto a canvas `scale` times its size, as a PNG, in base64.
 *
 * Twice the size by default, so that text in the picture stays sharp when it is printed or put
 * on a wall.
 */
export function svgToPng(svg: string, width: number, height: number, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("a picture could not be drawn here"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, ""));
    };
    image.onerror = () => reject(new Error("the picture could not be drawn"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
