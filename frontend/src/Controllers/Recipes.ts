import { Controllers } from "../Globals";

export var coords: Record<string, any> = {}
export var translations: Record<string, string> = {}
export var recipesLoaded = false;

async function getCoords() {
  coords = await fetch("/reciper/rects").then(res => res.json())
}

async function getTranslations() {
  translations = await fetch("/reciper/translations").then(res => res.json())
}

async function loadRecipes() {
  await Promise.all([
    getCoords(),
    getTranslations()
  ]);
  recipesLoaded = true;
}

Controllers.push({
  Begin: (_canvas: SVGGElement) => {
    loadRecipes()
  },
  End: (_canvas: SVGGElement) => {

  },
});
