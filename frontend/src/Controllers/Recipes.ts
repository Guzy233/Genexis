import { GetCoords } from "../../wailsjs/go/main/App";
import { Controllers } from "../Globals";

export var coords: Record<string, any> = {}

async function getCoords() {
  coords = await GetCoords()
}

Controllers.push({
  Begin: (_canvas: SVGGElement) => {
    getCoords()
  },
  End: (_canvas: SVGGElement) => {

  },
});
