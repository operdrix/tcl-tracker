'use client';

import { GrandLyonLine, GrandLyonStop, tclService, Vehicle } from '@/services/tcl';
import { GoogleMap, InfoWindow, LoadScript, Marker, MarkerClusterer, Polyline } from '@react-google-maps/api';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

const mapContainerStyle = {
  width: '100vw',
  height: '100vh'
};

const center = {
  lat: 45.749431,
  lng: 4.859991
};

const getVehicleIcon = (type: 'tram' | 'metro' | 'funicular') => {
  switch (type) {
    case 'tram':
      return '/tram-icon.svg';
    case 'metro':
      return '/metro-icon.svg';
    case 'funicular':
      return '/funicular-icon.svg';
  }
};

const getLineLogoUrl = (line: { ligne: string }): string => {
  return `https://www.tcl.fr/themes/custom/sytral_theme/img/lignes/${line.ligne}.svg`;
};

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [lines, setLines] = useState<GrandLyonLine[]>([]);
  const [stops, setStops] = useState<GrandLyonStop[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  //const [selectedLine, setSelectedLine] = useState<GrandLyonLine | null>(null);
  const [selectedStop, setSelectedStop] = useState<GrandLyonStop | null>(null);
  const [infoWindowPosition, setInfoWindowPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [clusterStops, setClusterStops] = useState<GrandLyonStop[]>([]);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vehiclesData, linesData] = await Promise.all([
          tclService.getVehicles(),
          tclService.getLines()
        ]);

        const stopsData = await tclService.getStops(linesData);

        setVehicles(vehiclesData);
        setLines(linesData);
        setStops(stopsData);
      } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLineClick = (line: GrandLyonLine, event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      //setSelectedLine(line);
      setInfoWindowPosition({
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      });
    }
  };

  const handleClusterLineClick = (lineId: string, stopsAtLocation: GrandLyonStop[]) => {
    if (stopsAtLocation.length > 0 && mapRef.current) {
      // Calculer les limites pour englober tous les arrêts du cluster
      const bounds = new google.maps.LatLngBounds();
      stopsAtLocation.forEach(stop => {
        bounds.extend({ lat: stop.lat, lng: stop.lon });
      });

      // Zoomer sur les arrêts avec un peu de marge
      mapRef.current.fitBounds(bounds, 300);

      // Fermer l'InfoWindow
      setClusterStops([]);
      setSelectedStop(null);
      setInfoWindowPosition(null);
    }
  };

  return (
    <main className="relative">
      <div className="absolute top-4 right-20 z-10">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={13}
          onLoad={map => {
            mapRef.current = map;
          }}
          options={{
            styles: theme === 'dark' ? [
              { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
              { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
              { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
              { featureType: 'poi', stylers: [{ visibility: 'off' }] },
              { featureType: 'transit.station', stylers: [{ visibility: 'off' }] },
              { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
              { featureType: 'landscape.man_made', stylers: [{ visibility: 'off' }] },
              { featureType: 'transit.line', stylers: [{ visibility: 'on' }] },
              { featureType: 'transit', elementType: 'geometry', stylers: [{ visibility: 'on' }] }
            ] : [
              { featureType: 'poi', stylers: [{ visibility: 'off' }] },
              { featureType: 'transit.station', stylers: [{ visibility: 'off' }] },
              { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
              { featureType: 'landscape.man_made', stylers: [{ visibility: 'off' }] },
              { featureType: 'transit.line', stylers: [{ visibility: 'on' }] },
              { featureType: 'transit', elementType: 'geometry', stylers: [{ visibility: 'on' }] }
            ],
            zoomControl: true,
            zoomControlOptions: {
              position: 7 // RIGHT_BOTTOM
            }
          }}
        >
          {/* Affichage des lignes */}
          {lines.map((line) => (
            <Polyline
              key={line.code_ligne}
              path={line.coordinates}
              options={{
                strokeColor: line.couleur,
                strokeOpacity: 0.5,
                strokeWeight: 3,
              }}
              onClick={(event) => handleLineClick(line, event)}
            />
          ))}

          {/* Affichage des véhicules */}
          {vehicles.map((vehicle) => (
            <Marker
              key={vehicle.id}
              position={vehicle.position}
              onClick={() => setSelectedVehicle(vehicle)}
              icon={{
                url: getVehicleIcon(vehicle.type),
                scaledSize: new google.maps.Size(30, 30)
              }}
            />
          ))}

          {/* Affichage des arrêts */}
          <MarkerClusterer
            options={{
              imagePath: '/stop-icon.svg',
              maxZoom: 16,
              gridSize: 20,
              styles: [
                {
                  textColor: 'transparent',
                  url: '/stop-icon.svg',
                  height: 24,
                  width: 24,
                  textSize: -1
                }
              ],
              zoomOnClick: false
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={(event: any) => {
              if (event.markers) {
                const clusterStops = event.markers.map((marker: google.maps.Marker) =>
                  stops.find((s: GrandLyonStop) => s.lat === marker.getPosition()?.lat() && s.lon === marker.getPosition()?.lng())
                ).filter((stop: GrandLyonStop | undefined): stop is GrandLyonStop => stop !== undefined);

                console.log('Cluster cliqué:', clusterStops);
                const position = event.getCenter?.() || event.position || event.latLng;

                // Si on clique sur le même cluster, on ferme l'InfoWindow
                if (position &&
                  infoWindowPosition &&
                  position.lat() === infoWindowPosition.lat &&
                  position.lng() === infoWindowPosition.lng) {
                  setClusterStops([]);
                  setSelectedStop(null);
                  setInfoWindowPosition(null);
                } else {
                  setClusterStops(clusterStops);
                  setSelectedStop(null);
                  if (position) {
                    setInfoWindowPosition({
                      lat: position.lat(),
                      lng: position.lng()
                    });
                  }
                }
              }
            }}
          >
            {(clusterer) => (
              <>
                {stops.map((stop) => (
                  <Marker
                    key={`${stop.id}-${stop.desserte.split(',')[0]}`}
                    position={{ lat: stop.lat, lng: stop.lon }}
                    onClick={() => {
                      console.log('Arrêt cliqué:', stop);
                      // Si on clique sur le même arrêt, on ferme l'InfoWindow
                      if (selectedStop?.id === stop.id &&
                        infoWindowPosition &&
                        infoWindowPosition.lat === stop.lat &&
                        infoWindowPosition.lng === stop.lon) {
                        setSelectedStop(null);
                        setClusterStops([]);
                        setInfoWindowPosition(null);
                      } else {
                        setSelectedStop(stop);
                        setClusterStops([]);
                        setInfoWindowPosition({ lat: stop.lat, lng: stop.lon });
                      }
                    }}
                    icon={{
                      url: '/stop-icon.svg',
                      scaledSize: new google.maps.Size(24, 24),
                      anchor: new google.maps.Point(12, 12)
                    }}
                    clusterer={clusterer}
                    zIndex={1}
                  />
                ))}
              </>
            )}
          </MarkerClusterer>

          {selectedVehicle && (
            <InfoWindow
              position={selectedVehicle.position}
              onCloseClick={() => setSelectedVehicle(null)}
            >
              <div className="p-2">
                <h3 className="font-bold">Ligne {selectedVehicle.line}</h3>
                <p>Prochain arrêt: {selectedVehicle.nextStop}</p>
                <p>Sens: {selectedVehicle.direction}</p>
              </div>
            </InfoWindow>
          )}

          {/* Affichage de l'info window de l'arrêt ou du cluster d'arrêts */}
          {(selectedStop || clusterStops.length > 0) && infoWindowPosition && (
            <InfoWindow
              position={infoWindowPosition}
              onCloseClick={() => {
                setSelectedStop(null);
                setInfoWindowPosition(null);
                setClusterStops([]);
              }}
              options={{
                pixelOffset: new google.maps.Size(0, -30)
              }}
            >
              <div className="p-3 min-w-[250px]">
                <style jsx global>{`
                  .gm-style .gm-style-iw-c {
                    padding: 0 !important;
                  }
                  .gm-style .gm-style-iw-t::after {
                    background: none !important;
                  }
                  .gm-style button.gm-style-iw-close {
                    width: 20px !important;
                    height: 20px !important;
                    right: 8px !important;
                    top: 8px !important;
                    font-size: 16px !important;
                    line-height: 20px !important;
                    padding: 0 !important;
                    background: none !important;
                    border: none !important;
                    cursor: pointer !important;
                  }
                `}</style>
                {clusterStops.length > 0 ? (
                  <>
                    <h3 className="font-bold text-lg mb-2">
                      {new Set(clusterStops.flatMap(stop =>
                        stop.desserte.split(',').map(line => line.split(':')[0])
                      )).size} lignes
                    </h3>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {/* Regrouper les arrêts par nom */}
                      {Array.from(new Set(clusterStops.map(stop => stop.nom))).map(stopName => {
                        const stopsAtLocation = clusterStops.filter(stop => stop.nom === stopName);
                        // Fusionner les dessertes de tous les arrêts à cet emplacement
                        const allLines = new Set(stopsAtLocation.flatMap(stop =>
                          stop.desserte.split(',').map(line => line.split(':')[0])
                        ));

                        return (
                          <div key={stopName} className="border-b border-gray-200 dark:border-gray-700 pb-2 last:border-0">
                            <h4 className="font-medium">{stopName}</h4>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {Array.from(allLines).map(lineId => {
                                const lineInfo = lines.find(l => l.code_ligne === lineId);
                                if (!lineInfo) return null;
                                return (
                                  <div
                                    key={lineId}
                                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded"
                                    onClick={() => handleClusterLineClick(lineId, stopsAtLocation)}
                                  >
                                    <Image
                                      src={getLineLogoUrl(lineInfo)}
                                      alt={`Logo ligne ${lineInfo.ligne}`}
                                      width={16}
                                      height={16}
                                      className="w-4 h-4"
                                    />
                                    <span>{lineInfo.nom_trace}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : selectedStop && (
                  <>
                    <h3 className="font-bold text-lg mb-2">{selectedStop.nom}</h3>
                    <div className="space-y-2">
                      {selectedStop.desserte.split(',').map((line) => {
                        const [lineId, direction] = line.split(':');
                        const lineInfo = lines.find(l => l.code_ligne === lineId);
                        if (!lineInfo) return null;

                        return (
                          <div key={lineId} className="flex items-start gap-2">
                            <Image
                              src={getLineLogoUrl(lineInfo)}
                              alt={`Logo ligne ${lineInfo.ligne}`}
                              width={24}
                              height={24}
                              className="mt-1 w-6 h-6"
                            />
                            <div className="flex-1">
                              <div className="font-medium">{lineInfo.nom_trace}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Direction {direction === 'A' ? lineInfo.nom_destination : lineInfo.nom_origine}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                      {selectedStop.pmr ? (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm">Accessible PMR</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm">Non accessible PMR</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>
    </main>
  );
} 