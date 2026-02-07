import type { VTracerConfig } from '../components/ImageConverter/ImageConverter';

export const generateSVG = async (
  file: File,
  config: VTracerConfig,
  maxSize: number
): Promise<string> => {
  const imageUrl = URL.createObjectURL(file);
  const img = new Image();
  
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });

  const canvas = document.createElement('canvas');
  let width = img.width;
  let height = img.height;
  
  if (width > maxSize || height > maxSize) {
    const scale = maxSize / Math.max(width, height);
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
  }
  
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Failed to create canvas context');

  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(imageUrl);

  const VTracer = await import('vtracer-wasm');
  await VTracer.default(fetch('/vtracer.wasm'));
  
  const rgbaData = imageData.data;
  const deg2rad = (deg: number) => (deg / 180) * Math.PI;
  
  const vtracerConfig = {
    binary: false,
    mode: config.mode,
    hierarchical: 'stacked',
    cornerThreshold: deg2rad(config.cornerThreshold),
    lengthThreshold: config.lengthThreshold,
    maxIterations: 10,
    spliceThreshold: deg2rad(config.spliceThreshold),
    filterSpeckle: config.filterSpeckle,
    colorPrecision: config.colorPrecision,
    layerDifference: config.layerDifference,
    pathPrecision: 5
  };
  
  const svgString = VTracer.to_svg(
    new Uint8Array(rgbaData),
    canvas.width,
    canvas.height,
    vtracerConfig
  );

  // Ensure SVG has viewBox for proper scaling
  // VTracer outputs width/height attributes, add viewBox to make it responsive
  const svgWithViewBox = svgString.replace(
    /(<svg[^>]*width=")[^"]+("[^>]*height=")[^"]+(")/,
    `$1${canvas.width}$2${canvas.height}$3 viewBox="0 0 ${canvas.width} ${canvas.height}"`
  );

  return svgWithViewBox;
};
