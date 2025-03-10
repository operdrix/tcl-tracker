import axios from 'axios';

export interface GrandLyonLine {
  ligne: string; // nom de la ligne
  code_ligne: string; // code de la ligne
  type_trace: string; // inutilisé
  nom_trace: string; // nom de la ligne
  sens: string; // sens de la ligne (Aller ou Retour)
  origine: string; // id de l'arrêt d'origine
  destination: string; // id de l'arrêt de destination
  nom_origine: string; // nom de l'arrêt d'origine
  nom_destination: string; // nom de l'arrêt de destination
  famille_transport: string; // TRA, MET, FUN
  date_debut: string; // inutilisé
  date_fin: string | null; // inutilisé
  code_type_ligne: string; // inutilisé
  nom_type_ligne: string; // inutilisé
  pmr: boolean; // inutilisé
  code_tri_ligne: string; // Nom alternatif de la ligne
  nom_version: string; // inutilisé
  last_update: string; // inutilisé
  last_update_fme: string; // inutilisé
  gid: number; // inutilisé
  couleur: string; // couleur de la ligne en format RGB (ex: "255 0 0")
  code_trace: string; // inutilisé
  coordinates: Array<{ lat: number; lng: number }>; // coordonnées de la ligne
}

interface GrandLyonGeoFeature {
  type: string; // inutilisé
  id: string; // inutilisé
  geometry: {
    type: string; // inutilisé
    coordinates: number[][][]; // coordonnées de la ligne
  };
  properties: GrandLyonLine; // Liaison par code_ligne
  bbox: number[]; // inutilisé
}

interface GrandLyonGeoResponse {
  type: string; // inutilisé
  features: GrandLyonGeoFeature[]; // liste de features
  totalFeatures: number; // inutilisé
  numberMatched: number; // inutilisé
  numberReturned: number; // inutilisé
  timeStamp: string; // inutilisé
  crs: {
    type: string; // inutilisé
    properties: {
      name: string; // inutilisé
    };
  };
  bbox: number[]; // inutilisé
}

export interface GrandLyonStop {
  id: number; // id de l'arrêt  
  nom: string; // nom de l'arrêt
  desserte: string; // liste des lignes desservant l'arrêt séparé par des virgules (code_ligne:[A,R]) A pour aller et R pour retour
  pmr: boolean; // inutilisé
  ascenseur: boolean; // inutilisé
  escalator: boolean; // inutilisé
  gid: number; // inutilisé
  last_update: string; // inutilisé
  last_update_fme: string; // inutilisé
  adresse: string; // adresse de l'arrêt
  localise_face_a_adresse: boolean; // inutilisé
  commune: string; // Commune de l'arrêt
  insee: string; // inutilisé
  lon: number; // longitude de l'arrêt
  lat: number; // latitude de l'arrêt
}

export interface Vehicle {
  id: string;
  line: string;
  type: 'tram' | 'metro' | 'funicular';
  position: {
    lat: number;
    lng: number;
  };
  nextStop: string;
  direction: string;
}

export interface NextPassage {
  id: string;
  ligne: string;
  direction: string;
  delaipassage: number;
  type: 'E' | 'T';
  heurepassage: string;
  idarretdestination: number;
}

const METRO_LINES_API_URL = '/api/grandlyon/fr/datapusher/ws/rdata/tcl_sytral.tcllignemf_2_0_0/all.json?maxfeatures=-1&start=1';
const METRO_GEO_API_URL = '/api/grandlyon/geoserver/sytral/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=sytral:tcl_sytral.tcllignemf_2_0_0&outputFormat=application/json&SRSNAME=EPSG:4171&startIndex=0&sortBy=gid';

const TRAM_LINES_API_URL = '/api/grandlyon/fr/datapusher/ws/rdata/tcl_sytral.tcllignetram_2_0_0/all.json?maxfeatures=-1&start=1';
const TRAM_GEO_API_URL = '/api/grandlyon/geoserver/sytral/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=sytral:tcl_sytral.tcllignetram_2_0_0&outputFormat=application/json&SRSNAME=EPSG:4171&startIndex=0&sortBy=gid';

const STOPS_API_URL = '/api/grandlyon/fr/datapusher/ws/rdata/tcl_sytral.tclarret/all.json?maxfeatures=-1&start=1';

const NEXT_PASSAGES_API_URL = '/api/grandlyon/fr/datapusher/ws/rdata/tcl_sytral.tclpassagearret/all.json?maxfeatures=-1&start=1&filename=prochains-passages-reseau-transports-commun-lyonnais-rhonexpress-disponibilites-temps-reel';

const convertRGBToHex = (rgb: string): string => {
  try {
    const [r, g, b] = rgb.split(' ').map(Number);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch (error) {
    console.error('Erreur lors de la conversion de la couleur:', rgb, error);
    return '#000000';
  }
};

const processLines = (lines: GrandLyonLine[], features: GrandLyonGeoFeature[]): GrandLyonLine[] => {
  // Dédupliquer les lignes par code_ligne
  const uniqueLines = lines.reduce((acc, line) => {
    if (!acc.find(l => l.code_ligne === line.code_ligne)) {
      acc.push(line);
    }
    return acc;
  }, [] as GrandLyonLine[]);

  const result = uniqueLines.map(line => {
    const feature = features.find(f => f.properties.code_ligne === line.code_ligne);
    if (!feature) {
      return null;
    }

    const processedLine = {
      ...line,
      couleur: convertRGBToHex(line.couleur),
      coordinates: feature.geometry.coordinates[0].map(coord => ({
        lng: coord[0],
        lat: coord[1]
      }))
    };

    return processedLine;
  }).filter((line): line is GrandLyonLine => line !== null);

  return result;
};

// Cache pour les prochains passages
let nextPassagesCache: NextPassage[] = [];
let lastNextPassagesUpdate = 0;
const CACHE_DURATION = 30000; // 30 secondes

// Fonction utilitaire pour créer l'en-tête d'authentification Basic
const createBasicAuthHeader = () => {
  const username = process.env.NEXT_PUBLIC_GRANDLYON_LOGIN;
  const password = process.env.NEXT_PUBLIC_GRANDLYON_PASSWORD;

  if (!username || !password) {
    console.error('Identifiants GrandLyon manquants dans les variables d\'environnement');
    return {};
  }

  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  return {
    'Authorization': `Basic ${auth}`
  };
};

export const tclService = {
  async getVehicles(): Promise<Vehicle[]> {
    try {
      // TODO: Implémenter avec l'API des véhicules en temps réel
      return [];
    } catch (error) {
      console.error('Erreur lors de la récupération des véhicules:', error);
      return [];
    }
  },

  async getLines(): Promise<GrandLyonLine[]> {
    try {
      const [
        metroLinesResponse,
        metroGeoResponse,
        tramLinesResponse,
        tramGeoResponse
      ] = await Promise.all([
        axios.get<{ values: GrandLyonLine[] }>(METRO_LINES_API_URL),
        axios.get<GrandLyonGeoResponse>(METRO_GEO_API_URL),
        axios.get<{ values: GrandLyonLine[] }>(TRAM_LINES_API_URL),
        axios.get<GrandLyonGeoResponse>(TRAM_GEO_API_URL)
      ]);

      const metroLines = processLines(metroLinesResponse.data.values, metroGeoResponse.data.features);
      const tramLines = processLines(tramLinesResponse.data.values, tramGeoResponse.data.features);

      return [...metroLines, ...tramLines];
    } catch (error) {
      console.error('Erreur lors de la récupération des lignes:', error);
      return [];
    }
  },

  async getStops(availableLines: GrandLyonLine[]): Promise<GrandLyonStop[]> {
    try {
      const response = await axios.get<{ values: GrandLyonStop[] }>(STOPS_API_URL);

      if (!response.data.values || !Array.isArray(response.data.values)) {
        console.error('Format de réponse invalide pour les arrêts:', response.data);
        return [];
      }

      // Filtrer pour ne garder que les arrêts desservis par les lignes fournies
      const filteredStops = response.data.values.filter(stop => {
        if (!stop.desserte) return false;

        const desserte = stop.desserte.toUpperCase();
        const stopLines = desserte.split(',');

        return stopLines.some(line => {
          const [lineId] = line.split(':');
          return availableLines.some(l => l.code_ligne === lineId);
        });
      });

      return filteredStops;
    } catch (error) {
      console.error('Erreur lors de la récupération des arrêts:', error);
      return [];
    }
  },

  async getNextPassages(availableLines: GrandLyonLine[]): Promise<NextPassage[]> {
    try {
      const now = Date.now();

      // Si le cache est valide, on le retourne
      if (now - lastNextPassagesUpdate < CACHE_DURATION) {
        console.log('Utilisation du cache des prochains passages:', {
          nombrePassages: nextPassagesCache.length,
          derniereMiseAJour: new Date(lastNextPassagesUpdate).toLocaleTimeString(),
          passages: nextPassagesCache
        });
        return nextPassagesCache;
      }

      // On récupère les codes de lignes disponibles
      const lineCodes = availableLines.map(line => line.code_ligne);

      // On construit l'URL avec le filtre sur les lignes
      const passagesUrl = `${NEXT_PASSAGES_API_URL}&ligne__in=${lineCodes.join(',')}`;

      const response = await axios.get<{ values: NextPassage[] }>(passagesUrl, {
        headers: {
          ...createBasicAuthHeader(),
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });

      if (!response.data.values || !Array.isArray(response.data.values)) {
        console.debug('Format de réponse invalide pour les prochains passages:', response.data);
        return nextPassagesCache;
      }

      // Mettre à jour le cache
      nextPassagesCache = response.data.values;
      lastNextPassagesUpdate = now;

      console.log('Nouvelles données des prochains passages:', {
        request: passagesUrl,
        nombreTotal: response.data.values.length,
        lignesDisponibles: lineCodes,
        passages: response.data.values
      });

      return response.data.values;
    } catch (error) {
      // On log l'erreur en debug pour ne pas polluer la console en production
      console.debug('Erreur lors de la récupération des prochains passages:', error);
      // On retourne le cache existant sans perturber l'utilisateur
      return nextPassagesCache;
    }
  },

  // Fonction utilitaire pour obtenir les prochains passages d'un arrêt
  getNextPassagesForStop(stopId: number, nextPassages: NextPassage[]): NextPassage[] {
    return nextPassages
      .filter(passage => passage.idarretdestination === stopId)
      .sort((a, b) => a.delaipassage - b.delaipassage)
      .slice(0, 2); // On ne garde que les 2 prochains passages
  }
}; 