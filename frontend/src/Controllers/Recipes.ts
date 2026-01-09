import { Controllers } from "../Globals";

export var coords: Record<string, any> = {}

async function getCoords() {
  coords = await fetch("/reciper/rects").then(res => res.json())
}

Controllers.push({
  Begin: (_canvas: SVGGElement) => {
    getCoords()
  },
  End: (_canvas: SVGGElement) => {

  },
});
