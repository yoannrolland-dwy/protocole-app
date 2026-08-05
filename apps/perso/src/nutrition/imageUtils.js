// Redimensionnement client des photos avant envoi à l'API (Carte resto, Photo d'un plat) —
// une photo de téléphone brute pèse plusieurs Mo, inutile en tokens/temps de requête pour
// une image que le modèle n'a besoin de lire qu'à une résolution modeste. Extrait de
// RestaurantMenu.jsx le 05/08/2026 quand Photo d'un plat en a eu besoin aussi.
export function fileToImagePayload(file, maxDim = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image illisible"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale) || 1;
        const h = Math.round(img.height * scale) || 1;
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const jpeg = canvas.toDataURL("image/jpeg", quality);
        resolve({ dataUrl: jpeg, base64: jpeg.split(",")[1], mediaType: "image/jpeg" });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
