import './style.css';
import L from 'leaflet';

type POICategory = 'playa' | 'restaurante' | 'museo' | 'inicio' | 'generico';

interface POI {
  id: string;
  lat: number;
  lng: number;
  name: string;
  description: string;
  category: POICategory;
  imgUrl?: string;
  imgUrls?: string[];
  vidUrl?: string;
  isInitial?: boolean;
}


interface Evento {
  id: string;
  name: string;
  date: string;
  description: string;
  lat: number;
  lng: number;
}

const EVENTS_DATA: Evento[] = [
  {
    id: 'ev-1',
    name: 'Fiesta de San Fins',
    date: '1 de Agosto, 2026',
    description: 'Tradicional fiesta local en Beluso con música en directo y gastronomía.',
    lat: 42.3315,
    lng: -8.8160
  },
  {
    id: 'ev-2',
    name: 'Ruta de Senderismo Cabo Udra',
    date: '15 de Agosto, 2026',
    description: 'Visita guiada por el espacio protegido de Cabo Udra al atardecer.',
    lat: 42.3276,
    lng: -8.8286
  },
  {
    id: 'ev-3',
    name: 'Mercadillo de Artesanía',
    date: '22 de Agosto, 2026',
    description: 'Venta de productos locales y artesanía en el puerto de Beluso.',
    lat: 42.3312,
    lng: -8.8155
  }
];

const calculateTidesForDate = (date: Date) => {
  // Referencia: Una marea alta en Bueu (aprox) el 01-04-2024 a las 03:00
  const epoch = new Date('2024-04-01T03:00:00').getTime();
  const current = date.getTime();
  const diffHours = (current - epoch) / (1000 * 60 * 60);

  // El periodo de marea alta es de ~12.42 horas
  const tideCycle = 12.42;
  const cyclesSinceEpoch = diffHours / tideCycle;
  const cycleFraction = cyclesSinceEpoch - Math.floor(cyclesSinceEpoch);

  // Calcular la próxima marea alta desde ahora
  const hoursToNextHigh = (1 - cycleFraction) * tideCycle;
  const nextHigh = new Date(current + hoursToNextHigh * 60 * 60 * 1000);
  const nextLow = new Date(nextHigh.getTime() - (tideCycle / 2) * 60 * 60 * 1000);

  return {
    high: nextHigh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    low: nextLow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
};

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const CATEGORY_EMOJIS: Record<POICategory, string> = {
  playa: '🏖️',
  restaurante: '🍽️',
  museo: '🏛️',
  inicio: '🏡',
  generico: '📍'
};

const DEFAULT_POIS: POI[] = [
  {
    id: 'poi-main-villa-jenny',
    lat: 42.332029,
    lng: -8.814324,
    name: 'Villa Jenny',
    description: 'Tu punto de partida en el corazón de Beluso.',
    category: 'inicio',
    imgUrl: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=300&q=80',
    isInitial: true
  },
  {
    id: 'poi-centoleira',
    lat: 42.330089,
    lng: -8.816670,
    name: 'Restaurante A Centoleira',
    description: 'Emblemático restaurante en la playa de Beluso, famoso por su marisco.',
    category: 'restaurante',
    imgUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'poi-peixoto',
    lat: 42.331200,
    lng: -8.815500,
    name: 'Restaurante Peixoto',
    description: 'Conocido por sus vistas al puerto deportivo y excelentes pescados.',
    category: 'restaurante',
    imgUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'poi-udra',
    lat: 42.3412,
    lng: -8.8349,
    name: 'Cabo Udra',
    description: 'Un mirador natural con multitud de sendas conectadas entre si que recorren todo el cabo entre rocas erosionadas por el viento, donde se juntan la Ría de Pontevedra al norte, y la Ría de Aldán al sur, y enfrente la Isla de Ons, pertenecientes al Parque Nacional Marítimo Terrestre de As Illas Atlánticas.\n\nEn los alrededores de Cabo Udra se encuentran las ruinas de un cuartel militar conocido como Batería J-2 que formaba parte del sistema defensivo, una estación meteorológica, el Aula de la Naturaleza y en frente un chiringuito donde tomar algo. También a un lado del camino podemos ver un cruceiro bastante curioso, que suelen marcar los cruces de caminos, y los chouzos de Chan de Esqueiros, que son refugios construidos para los pastores de la zona, aprovechando los huecos de las rocas y tapando con losas para poder pasar la noche con su ganado.\n\nAl final de la tarde recomiendo que te acomodes un momento en las piedras, te aseguro que el atardecer en Cabo Udra es espectacular.',
    category: 'playa',
    imgUrls: [
      '/assets/pois/Cabo Udra/1.jpg',
      '/assets/pois/Cabo Udra/2.jpg',
      '/assets/pois/Cabo Udra/3.jpg',
      '/assets/pois/Cabo Udra/chouzos.jpg',
      '/assets/pois/Cabo Udra/cruceiro.jpg'
    ]
  },
  {
    id: 'poi-tuia',
    lat: 42.321000,
    lng: -8.821000,
    name: 'Playa de Tuia',
    description: 'Arenal extenso y rodeado de naturaleza. Ideal para un día tranquilo.',
    category: 'playa',
    imgUrl: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'poi-museo',
    lat: 42.326972,
    lng: -8.785167,
    name: 'Museo Massó (Bueu)',
    description: 'Historia marinera, conservera y tradición de construcción de barcos.',
    category: 'museo',
    imgUrl: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'poi-pedron-v2',
    lat: 42.340583,
    lng: -8.826278,
    name: 'Playa de Pedrón',
    description: 'Cala virgen y salvaje, rodeada de pinos y rocas. Un rincón natural de gran belleza para desconectar.',
    category: 'playa',
    imgUrl: 'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'poi-sartaxens-v2',
    lat: 42.338583,
    lng: -8.807944,
    name: 'Playa de Sartaxéns',
    description: 'Pequeña cala de aguas tranquilas y cristalinas, ideal para disfrutar del entorno natural en privacidad.',
    category: 'playa',
    imgUrl: 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'poi-bon',
    lat: 42.3168516,
    lng: -8.8207187,
    name: 'Area de Bon',
    description: 'Playa de arena gruesa, sitio para aparcar, duchas, baños y dos chiringuitos donde puedes llevar tu propia comida y pedir allí la bebida.',
    category: 'playa',
    imgUrls: [
      '/assets/pois/Area do Bon/1.jpg',
      '/assets/pois/Area do Bon/2.jpg',
      '/assets/pois/Area do Bon/3.jpg'
    ]
  },
  {
    id: 'poi-iglesia-beluso',
    lat: 42.330806,
    lng: -8.813583,
    name: 'Iglesia Santa María Beluso',
    description: 'Monumento del siglo XII con reformas posteriores. Un remanso de paz con gran valor histórico.',
    category: 'museo',
    imgUrl: 'https://images.unsplash.com/photo-1548678912-4192a65cc9f6?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'poi-pantalan',
    lat: 42.331200,
    lng: -8.816000,
    name: 'Pantalán de Beluso',
    description: 'Zona de amarre tradicional donde se pueden ver dornas y barcos de pesca artesanal.',
    category: 'generico',
    imgUrl: 'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'poi-lagos',
    lat: 42.324556,
    lng: -8.825452,
    name: 'Praia de Lagos',
    description: 'Playa de Lagos, a 4 minutos en coche desde la casa, es una playa pequeña de arena blanca que pertenece a la zona protegida del Cabo de Udra. Desde allí podemos ver al fondo la Isla de Ons del Parque Natural de las Islas Atlánticas.',
    category: 'playa',
    imgUrls: [
      '/assets/pois/Praia de Lagos/105974scr_3fb901e888d0e43.jpg',
      '/assets/pois/Praia de Lagos/107454scr_d96f10155de3122.jpg',
      '/assets/pois/Praia de Lagos/95872scr_fc6ac388688cf6a.jpg'
    ]
  },
  {
    id: 'poi-ancoradoiro',
    lat: 42.333800,
    lng: -8.826700,
    name: 'Playa de Ancoradoiro',
    description: 'Es una pequeña playa de poco más de 100 metros de longitud rodeada de rocas a la que se accede por un camino de tierra desde el aparcamiento de Cabo Udra, quizá un poco dificultoso para niños pequeños o personas con movilidad reducida, no hay socorristas ni servicios, pero se trata de un lugar salvaje y tranquilo, perfecto para quienes huyen de masificaciones y buscan relajarse.',
    category: 'playa',
    imgUrls: [
      '/assets/pois/Playa de Ancoradouro/1.jpg',
      '/assets/pois/Playa de Ancoradouro/2.jpg',
      '/assets/pois/Playa de Ancoradouro/3.jpg'
    ]
  },
  {
    id: 'poi-humedal',
    lat: 42.3290676,
    lng: -8.8251677,
    name: 'Humedal de Escorregadoiro',
    description: 'Este humedal forma parte de un sendero litoral de gran valor ecológico, es perfecto para dar un paseo por la naturaleza por caminos que parecen sacados de cuento.',
    category: 'playa',
    imgUrls: [
      '/assets/pois/Humedal de Escorregadoiro/1.jpg',
      '/assets/pois/Humedal de Escorregadoiro/2.jpg',
      '/assets/pois/Humedal de Escorregadoiro/3.jpg'
    ]
  },
  {
    id: 'poi-capilla-reyes',
    lat: 42.3424164,
    lng: -8.7909247,
    name: 'Capilla Santos Reyes',
    description: 'En caso de que te apetezca conocer un poco más de nuestro patrimonio, a 7 minutos en coche se encuentra esta pequeña capilla dedicada a los Reyes Magos. Aunque la actual es del s.XX, la original es del año 1686. En el exterior están representados la Virgen y San José, y en las esquinas los cuatro evangelistas, además tiene la peculiaridad de tener multitud de elementos decorativos relacionados con el mar como conchas marinas, ballenas, timones, anclas...',
    category: 'museo',
    imgUrls: [
      '/assets/pois/Capilla Santos Reyes/1.jpg',
      '/assets/pois/Capilla Santos Reyes/2.jpg'
    ]
  }
];


document.addEventListener('DOMContentLoaded', () => {
  // --- 1. Inicialización del Mapa ---
  const mapCenter: L.LatLngTuple = [DEFAULT_POIS[0].lat, DEFAULT_POIS[0].lng];
  const map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView(mapCenter, 14);

  // Remoción solicitada de controles zoom +/-
  // L.control.zoom({ position: 'bottomright' }).addTo(map);

  const standardLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 20
  });
  const satelliteLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&hl=es&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: ''
  });
  const trafficLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: ''
  });

  standardLayer.addTo(map);

  const baseMaps = {
    "Mapa": standardLayer,
    "Satélite": satelliteLayer
  };

  const overlayMaps = {
    "Tráfico": trafficLayer
  };

  const layersControl = L.control.layers(baseMaps, overlayMaps, { position: 'topright' }).addTo(map);
  const layersContainer = document.getElementById('map-layers-container');
  if (layersContainer) {
    layersContainer.appendChild(layersControl.getContainer()!);
  }

  // --- 2. Gestión de Estado y Datos ---
  const STORAGE_KEY = 'beluso_pois_v2';
  let pois: POI[] = [...DEFAULT_POIS];
  let markers: { [id: string]: L.Marker } = {};
  let isAdmin = false;
  let isRouteMode = false;
  let customRoutePoints: POI[] = [];
  let routePolyline: L.Polyline | null = null;

  const routeOverlay = document.getElementById('route-overlay') as HTMLElement;
  const routeTotalDist = document.getElementById('route-total-distance') as HTMLElement;
  const btnClearRoute = document.getElementById('btn-clear-route') as HTMLButtonElement;

  // --- 2.1 Gestión de Diseño Draggable ---
  const LAYOUT_KEY = 'beluso_ui_layout_v1';
  let uiLayout: { [id: string]: { top: string; left: string } } = {};

  const saveLayout = () => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(uiLayout));
  };

  const loadLayout = () => {
    const data = localStorage.getItem(LAYOUT_KEY);
    if (data) {
      uiLayout = JSON.parse(data);
      Object.keys(uiLayout).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.style.top = uiLayout[id].top;
          el.style.left = uiLayout[id].left;
          el.style.right = 'auto';
          el.style.bottom = 'auto';
        }
      });
    }
  };

  const makeDraggable = (el: HTMLElement) => {
    let isDragging = false;
    let startX: number, startY: number, initialX: number, initialY: number;

    const onStart = (e: MouseEvent | TouchEvent) => {
      if (!isAdmin) return;
      isDragging = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      startX = clientX;
      startY = clientY;
      
      const rect = el.getBoundingClientRect();
      const parentRect = document.getElementById('app')!.getBoundingClientRect();
      initialX = rect.left - parentRect.left;
      initialY = rect.top - parentRect.top;
      
      el.style.zIndex = '5000';
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const dx = clientX - startX;
      const dy = clientY - startY;
      
      el.style.top = `${initialY + dy}px`;
      el.style.left = `${initialX + dx}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      el.style.zIndex = '1000';
      uiLayout[el.id] = { top: el.style.top, left: el.style.left };
      saveLayout();
    };

    el.addEventListener('mousedown', onStart);
    el.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
  };

  const widget = document.getElementById('weather-widget');
  const layers = document.getElementById('map-layers-container');
  const header = document.getElementById('app-header');

  if (widget) makeDraggable(widget);
  if (layers) makeDraggable(layers);
  if (header) makeDraggable(header);

  loadLayout();

  const loadPOIs = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      let stored: POI[] = JSON.parse(data);

      // CORRECCIÓN DE DEPRECACIÓN: Eliminar puntos nudistas antiguos si existen en el almacenamiento
      // para que no se vuelvan a importar como puntos "personalizados"
      stored = stored.filter(p => !p.id.includes('pedron') && !p.id.includes('sartaxens'));

      // Usar la versión guardada de los puntos por defecto si existe
      pois = DEFAULT_POIS.map(def => {
        const found = stored.find(s => s.id === def.id);
        return found ? found : def;
      });
      // Añadir cualquier punto personalizado
      const customPoints = stored.filter(s => !DEFAULT_POIS.find(d => d.id === s.id));
      pois = [...pois, ...customPoints];
    }
  };

  const savePOIs = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pois));
  };

  const renderMarkers = () => {
    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};

    pois.forEach(poi => {
      const emoji = CATEGORY_EMOJIS[poi.category] || CATEGORY_EMOJIS['generico'];
      const icon = L.divIcon({
        className: `emoji-marker ${poi.category}`,
        html: `<span>${emoji}</span>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      });

      const marker = L.marker([poi.lat, poi.lng], {
        icon,
        draggable: isAdmin
      }).addTo(map);

      marker.on('click', () => {
        openBottomSheet(poi);
      });

      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        poi.lat = newPos.lat;
        poi.lng = newPos.lng;
        const latInput = document.getElementById('poi-lat') as HTMLInputElement;
        const lngInput = document.getElementById('poi-lng') as HTMLInputElement;
        if (latInput && lngInput && !adminModal.classList.contains('hidden')) {
          latInput.value = newPos.lat.toString();
          lngInput.value = newPos.lng.toString();
        }
        savePOIs();
      });

      markers[poi.id] = marker;
    });
  };

  // --- 3. Navegación Inferior e Interfaz de Detalles (Bottom Sheet) ---
  const bottomSheet = document.getElementById('bottom-sheet') as HTMLElement;
  const poiTitle = document.getElementById('poi-name') as HTMLElement;
  const poiDesc = document.getElementById('poi-desc') as HTMLElement;
  const poiImg = document.getElementById('poi-img') as HTMLImageElement;
  const poiVid = document.getElementById('poi-vid') as HTMLVideoElement;
  const btnAction = document.getElementById('btn-action') as HTMLButtonElement;
  const poiMedia = document.getElementById('poi-media') as HTMLElement;
  const carouselPrev = document.getElementById('carousel-prev') as HTMLButtonElement;
  const carouselNext = document.getElementById('carousel-next') as HTMLButtonElement;
  const carouselCounter = document.getElementById('carousel-counter') as HTMLElement;
  const poiDistance = document.getElementById('poi-distance') as HTMLElement;

  const closeBottomSheet = () => {
    bottomSheet.classList.remove('open');
  };

  const openBottomSheet = (poi: POI) => {
    if (!poiTitle || !poiDesc || !poiMedia) return;

    poiTitle.innerText = poi.name;
    poiDesc.innerText = poi.description;

    const poiCarousel = document.getElementById('poi-carousel') as HTMLElement;
    poiVid.pause();

    // Reiniciar carrusel y flechas
    if (poiCarousel) {
      poiCarousel.style.display = 'none';
      poiCarousel.innerHTML = '';
    }
    if (carouselPrev) carouselPrev.style.display = 'none';
    if (carouselNext) carouselNext.style.display = 'none';
    if (carouselCounter) carouselCounter.style.display = 'none';

    if (poi.vidUrl && poi.vidUrl.trim() !== '') {
      poiImg.style.display = 'none';
      poiVid.style.display = 'block';
      poiVid.src = poi.vidUrl;
      poiVid.play().catch(() => { });
    } else if (poi.imgUrls && poi.imgUrls.length > 0) {
      poiVid.style.display = 'none';
      poiImg.style.display = 'none';
      if (poiCarousel) {
        poiCarousel.style.display = 'flex';
        poiCarousel.innerHTML = poi.imgUrls.map(url => `<img src="${url}" style="min-width: 100%; height: 100%; object-fit: cover; scroll-snap-align: start;" />`).join('');

        if (poi.imgUrls.length > 1) {
          if (carouselPrev) carouselPrev.style.display = 'flex';
          if (carouselNext) carouselNext.style.display = 'flex';

          if (carouselCounter) {
            carouselCounter.style.display = 'block';
            carouselCounter.innerText = `1 / ${poi.imgUrls.length}`;
            poiCarousel.onscroll = () => {
              if (poi.imgUrls) {
                const index = Math.round(poiCarousel.scrollLeft / poiCarousel.clientWidth);
                carouselCounter.innerText = `${index + 1} / ${poi.imgUrls.length}`;
              }
            };
          }

          carouselPrev.onclick = (e) => {
            e.stopPropagation();
            if (poiCarousel) poiCarousel.scrollBy({ left: -poiCarousel.clientWidth, behavior: 'smooth' });
          };
          carouselNext.onclick = (e) => {
            e.stopPropagation();
            if (poiCarousel) poiCarousel.scrollBy({ left: poiCarousel.clientWidth, behavior: 'smooth' });
          };
        }
      }
    } else {
      poiVid.style.display = 'none';
      poiImg.style.display = 'block';
      poiImg.src = poi.imgUrl || 'https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=300&q=80';
    }

    if (isAdmin) {
      btnAction.innerText = 'Editar Punto';
      btnAction.onclick = () => {
        closeBottomSheet();
        openAdminModal(poi.lat, poi.lng, poi);
      };
    } else {
      btnAction.innerText = 'Centrar en el Mapa';
      btnAction.onclick = () => {
        map.setView([poi.lat, poi.lng], 16, { animate: true });
        closeBottomSheet();
      };
    }

    bottomSheet.classList.add('open');
    map.setView([poi.lat, poi.lng], map.getZoom() > 13 ? map.getZoom() : 14);

    // Calcular y mostrar distancia desde Villa Jenny
    const villaJenny = pois.find(p => p.id === 'poi-main-villa-jenny');
    if (villaJenny && poi.id !== villaJenny.id) {
      const dist = getDistance(villaJenny.lat, villaJenny.lng, poi.lat, poi.lng);
      if (poiDistance) {
        poiDistance.innerText = `A ${dist.toFixed(2)} km de Villa Jenny`;
        poiDistance.style.display = 'block';
      }
    } else {
      if (poiDistance) poiDistance.style.display = 'none';
    }

    if (isRouteMode && poi.id !== 'poi-main-villa-jenny') {
      btnAction.innerText = customRoutePoints.find(p => p.id === poi.id) ? 'Quitar de la Ruta' : 'Añadir a mi Ruta';
      btnAction.onclick = () => {
        togglePointInRoute(poi);
        openBottomSheet(poi); // Refrescar botones
      };
    }
  };

  const navExplorar = document.getElementById('nav-explorar') as HTMLElement;
  const navEventos = document.getElementById('nav-eventos') as HTMLElement;
  const navRutas = document.getElementById('nav-rutas') as HTMLElement;
  const navMareas = document.getElementById('nav-mareas') as HTMLElement;
  const navMiRuta = document.getElementById('nav-mi-ruta') as HTMLElement;
  const adminToggle = document.getElementById('admin-toggle') as HTMLElement;

  const setActiveNav = (elem: HTMLElement) => {
    [navExplorar, navEventos, navRutas, navMareas, navMiRuta, adminToggle].forEach(e => e?.classList.remove('active'));
    elem?.classList.add('active');
  };

  navExplorar.addEventListener('click', (e) => {
    e.preventDefault();
    setActiveNav(navExplorar);
    isAdmin = false;
    toggleAdminUI();
  });

  navEventos?.addEventListener('click', (e) => {
    e.preventDefault();
    setActiveNav(navEventos);
    openEventsModal();
  });

  navRutas.addEventListener('click', (e) => {
    e.preventDefault();
    setActiveNav(navRutas);
    isAdmin = false;
    toggleAdminUI();
    map.setView(mapCenter, 14, { animate: true });
  });

  adminToggle.addEventListener('click', (e) => {
    e.preventDefault();
    if (isAdmin) {
      isAdmin = false;
      document.body.classList.remove('admin-mode');
      setActiveNav(navExplorar);
    } else {
      isAdmin = true;
      document.body.classList.add('admin-mode');
      setActiveNav(adminToggle);
    }
    toggleAdminUI();
  });

  navMareas?.addEventListener('click', (e) => {
    e.preventDefault();
    setActiveNav(navMareas);

    // Abrir modal en la pestaña de Mareas
    weatherDetailsModal.classList.remove('hidden');
    const tidesTabBtn = document.querySelector('.tab-btn[data-tab="mareas"]') as HTMLElement;
    tidesTabBtn?.dispatchEvent(new Event('click'));
  });

  navMiRuta?.addEventListener('click', (e) => {
    e.preventDefault();
    isRouteMode = !isRouteMode;
    if (isRouteMode) {
      setActiveNav(navMiRuta);
      isAdmin = false;
      toggleAdminUI();
      closeBottomSheet();
      // Empezar ruta desde Villa Jenny si está vacía
      if (customRoutePoints.length === 0) {
        const villaJenny = pois.find(p => p.id === 'poi-main-villa-jenny');
        if (villaJenny) customRoutePoints.push(villaJenny);
      }
    } else {
      setActiveNav(navExplorar);
      routeOverlay.classList.add('hidden');
    }
    updateRoutePolyline();
  });

  btnClearRoute?.addEventListener('click', () => {
    customRoutePoints = [];
    const villaJenny = pois.find(p => p.id === 'poi-main-villa-jenny');
    if (villaJenny) customRoutePoints.push(villaJenny);
    updateRoutePolyline();
    closeBottomSheet();
  });

  const togglePointInRoute = (poi: POI) => {
    const index = customRoutePoints.findIndex(p => p.id === poi.id);
    if (index > -1) {
      customRoutePoints.splice(index, 1);
    } else {
      customRoutePoints.push(poi);
    }
    updateRoutePolyline();
  };

  const updateRoutePolyline = () => {
    if (routePolyline) map.removeLayer(routePolyline);

    if (isRouteMode && customRoutePoints.length > 1) {
      const latlngs = customRoutePoints.map(p => [p.lat, p.lng] as L.LatLngTuple);
      routePolyline = L.polyline(latlngs, {
        color: '#6366f1',
        weight: 5,
        opacity: 0.8,
        dashArray: '10, 10',
        lineJoin: 'round'
      }).addTo(map);

      // Añadir clase de animación si el explorador lo soporta (añadido en CSS)
      const pathEl = (routePolyline as any)._path;
      if (pathEl && pathEl.classList) {
        pathEl.classList.add('route-line-animation');
      }

      const totalDist = customRoutePoints.reduce((acc, curr, i) => {
        if (i === 0) return 0;
        return acc + getDistance(customRoutePoints[i - 1].lat, customRoutePoints[i - 1].lng, curr.lat, curr.lng);
      }, 0);

      console.log(`Ruta personalizada: ${totalDist.toFixed(2)} km`);

      if (routeOverlay && routeTotalDist) {
        routeOverlay.classList.remove('hidden');
        routeTotalDist.innerText = `${totalDist.toFixed(2)} km`;
      }
    } else {
      if (routeOverlay) routeOverlay.classList.add('hidden');
    }
  };

  // --- Lógica de Eventos ---
  const eventsModal = document.getElementById('events-modal') as HTMLElement;
  const eventsList = document.getElementById('events-list') as HTMLElement;
  const btnCloseEvents = document.getElementById('btn-close-events') as HTMLElement;

  const openEventsModal = () => {
    if (!eventsList) return;
    eventsList.innerHTML = '';
    EVENTS_DATA.forEach(ev => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <span class="date">${ev.date}</span>
        <span class="name">${ev.name}</span>
        <span class="desc">${ev.description}</span>
        <small class="hint"><span>📍</span> Ver en Mapa</small>
      `;
      card.onclick = () => {
        map.setView([ev.lat, ev.lng], 16, { animate: true });
        eventsModal.classList.add('hidden');
        setActiveNav(navExplorar);
      };
      eventsList.appendChild(card);
    });
    eventsModal.classList.remove('hidden');
  };

  btnCloseEvents?.addEventListener('click', () => {
    eventsModal.classList.add('hidden');
    setActiveNav(navExplorar);
  });

  // --- 4. Lógica del Modo Administrador ---
  const adminControls = document.getElementById('admin-controls') as HTMLElement;
  const adminModal = document.getElementById('admin-modal') as HTMLElement;
  const poiForm = document.getElementById('poi-form') as HTMLFormElement;

  const toggleAdminUI = () => {
    adminControls.classList.toggle('admin-hidden', !isAdmin);
    closeBottomSheet();
    renderMarkers();
  };

  map.on('click', (e: L.LeafletMouseEvent) => {
    if (isAdmin) {
      openAdminModal(e.latlng.lat, e.latlng.lng);
    }
  });

  const openAdminModal = (lat: number, lng: number, existingPoi?: POI) => {
    const idInput = document.getElementById('poi-id') as HTMLInputElement;
    const latInput = document.getElementById('poi-lat') as HTMLInputElement;
    const lngInput = document.getElementById('poi-lng') as HTMLInputElement;
    const nameInput = document.getElementById('poi-input-name') as HTMLInputElement;
    const catInput = document.getElementById('poi-input-cat') as HTMLSelectElement;
    const descInput = document.getElementById('poi-input-desc') as HTMLTextAreaElement;
    const imgInput = document.getElementById('poi-input-img') as HTMLInputElement;
    const vidInput = document.getElementById('poi-input-vid') as HTMLInputElement;
    const btnDelete = document.getElementById('btn-delete-poi') as HTMLButtonElement;

    if (existingPoi) {
      idInput.value = existingPoi.id;
      nameInput.value = existingPoi.name;
      catInput.value = existingPoi.category;
      descInput.value = existingPoi.description;
      imgInput.value = existingPoi.imgUrl || '';
      vidInput.value = existingPoi.vidUrl || '';
      btnDelete.style.display = 'block';
    } else {
      poiForm.reset();
      idInput.value = '';
      catInput.value = 'generico';
      btnDelete.style.display = 'none';
    }

    latInput.value = lat.toString();
    lngInput.value = lng.toString();
    adminModal.classList.remove('hidden');
  };

  document.getElementById('btn-cancel-modal')?.addEventListener('click', () => {
    adminModal.classList.add('hidden');
  });

  poiForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const idVal = (document.getElementById('poi-id') as HTMLInputElement).value;
    const newPoi: POI = {
      id: idVal || 'poi-' + Date.now(),
      lat: parseFloat((document.getElementById('poi-lat') as HTMLInputElement).value),
      lng: parseFloat((document.getElementById('poi-lng') as HTMLInputElement).value),
      name: (document.getElementById('poi-input-name') as HTMLInputElement).value,
      category: (document.getElementById('poi-input-cat') as HTMLSelectElement).value as POICategory,
      description: (document.getElementById('poi-input-desc') as HTMLTextAreaElement).value,
      imgUrl: (document.getElementById('poi-input-img') as HTMLInputElement).value,
      vidUrl: (document.getElementById('poi-input-vid') as HTMLInputElement).value
    };

    if (idVal) {
      const index = pois.findIndex(p => p.id === idVal);
      if (index > -1) pois[index] = newPoi;
    } else {
      pois.push(newPoi);
    }

    savePOIs();
    renderMarkers();
    adminModal.classList.add('hidden');
  });

  document.getElementById('btn-delete-poi')?.addEventListener('click', () => {
    const idVal = (document.getElementById('poi-id') as HTMLInputElement).value;
    if (idVal) {
      pois = pois.filter(p => p.id !== idVal);
      savePOIs();
      renderMarkers();
      adminModal.classList.add('hidden');
    }
  });

  // --- 5. API de Clima Real y Personaje Interactivo ---
  const weatherWidget = document.getElementById('weather-widget') as HTMLElement;
  const rainContainer = document.getElementById('rain') as HTMLElement;
  const weatherDesc = document.getElementById('weather-desc') as HTMLElement;
  const tempVal = document.getElementById('temp-val') as HTMLElement;

  type WeatherState = 'sunny' | 'cloudy' | 'rain' | 'thunder';
  let currentWeather: WeatherState = 'rain'; // Estado base guiado por la API
  let weatherInterval: number | null = null;
  let extremeTimeout: number | null = null;

  const createParticle = (type: 'rain' | 'vomit' | 'wind' | 'thunder' | 'heart' | 'sparkle') => {
    if (!rainContainer) return;
    const particle = document.createElement('div');
    const left = Math.random() * 50;

    if (type === 'heart' || type === 'sparkle') {
      particle.className = type === 'heart' ? 'heart-particle' : 'heart-particle sparkle';
      particle.innerText = type === 'heart' ? '❤️' : '✨';
      particle.style.left = `${left}px`;
      rainContainer.appendChild(particle);
      setTimeout(() => particle.remove(), 1000);
      return;
    }

    if (type === 'rain' || type === 'vomit') {
      const cls = type === 'vomit' ? 'vomit-drop' : 'raindrop';
      particle.classList.add(cls);
      const duration = type === 'vomit' ? 0.2 + Math.random() * 0.2 : 0.5 + Math.random() * 0.3;
      particle.style.left = `${left}px`;
      particle.style.animationDuration = `${duration}s`;
      rainContainer.appendChild(particle);
      setTimeout(() => particle.remove(), duration * 1000);
    } else if (type === 'wind') {
      particle.classList.add('wind-line');
      particle.style.top = `${10 + Math.random() * 20}px`;
      rainContainer.appendChild(particle);
      setTimeout(() => particle.remove(), 500);
    } else if (type === 'thunder') {
      particle.classList.add('thunder-bolt');
      particle.style.left = `${20 + Math.random() * 20}px`;
      rainContainer.appendChild(particle);
      setTimeout(() => particle.remove(), 300);
    }
  };

  const startNormalWeather = () => {
    if (weatherInterval) clearInterval(weatherInterval);
    if (currentWeather === 'rain' || currentWeather === 'thunder') {
      weatherInterval = setInterval(() => createParticle('rain'), 80);
    }
  };

  const applyWeatherState = (state: WeatherState, desc: string, temp: number | string) => {
    currentWeather = state;
    tempVal.innerText = temp.toString();
    weatherDesc.innerText = desc;

    // Limpieza de clases
    weatherWidget.classList.remove('sunny', 'cloudy', 'rain', 'thunder', 'extreme');
    weatherWidget.classList.add(state);

    const sunRays = document.getElementById('sun-rays');
    if (sunRays) sunRays.style.display = (state === 'sunny') ? 'block' : 'none';

    // Actualizar fondo animado
    document.querySelectorAll('.weather-bg-state').forEach(el => el.classList.remove('active'));
    const bgElement = document.getElementById(`bg-${state === 'thunder' ? 'rain' : state}`);
    if (bgElement) bgElement.classList.add('active');

    // Actualizar fondo del widget de clima
    if (weatherWidget) {
      weatherWidget.classList.remove('bg-sunny', 'bg-cloudy', 'bg-rain');
      weatherWidget.classList.add(`bg-${state === 'thunder' ? 'rain' : state}`);
    }

    // Actualizar tema del modal de clima
    const weatherModalContent = document.querySelector('.weather-modal-content');
    if (weatherModalContent) {
      weatherModalContent.classList.remove('bg-sunny', 'bg-cloudy', 'bg-rain');
      weatherModalContent.classList.add(`bg-${state === 'thunder' ? 'rain' : state}`);
    }

    startNormalWeather();
  };

  const updateBathingStatus = (windSpeedKmH: number, state: WeatherState) => {
    const flag = document.getElementById('bathing-flag');
    if (!flag) return;

    flag.classList.remove('green', 'yellow', 'red', 'bicolor');

    if (state === 'thunder' || windSpeedKmH > 35) {
      flag.classList.add('red');
    } else if (state === 'rain' || windSpeedKmH > 20) {
      flag.classList.add('yellow');
    } else {
      // El estándar para áreas seguras supervisadas suele ser bicolor rojo/amarillo
      flag.classList.add('bicolor');
    }
  };

  let weatherFetchInterval: number | null = null;
  const fetchRealWeather = async () => {
    try {
      console.log("Obteniendo clima de Met Norway...");
      const lat = 42.332, lon = -8.814;
      const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;

      const res = await fetch(url, { headers: { 'User-Agent': 'AppBeluso/1.0 (contact@beluso.app)' } });
      if (!res.ok) throw new Error("Estado Met: " + res.status);

      const data = await res.json();
      const current = data.properties.timeseries[0];
      const temp = current.data.instant.details.air_temperature;
      const symbol = current.data.next_1_hours?.summary.symbol_code || current.data.next_6_hours?.summary.symbol_code || "fair_day";

      console.log("Clima:", symbol, temp);

      let state: WeatherState = 'sunny';
      let desc = 'Despejado';

      if (symbol.includes('sun') || symbol.includes('clear')) {
        state = 'sunny'; desc = 'Despejado';
      } else if (symbol.includes('rain')) {
        state = 'rain'; desc = 'Lluvia';
      } else if (symbol.includes('thunder')) {
        state = 'thunder'; desc = 'Tormenta';
      } else if (symbol.includes('cloud') || symbol.includes('fair') || symbol.includes('fog')) {
        state = 'cloudy'; desc = 'Nublado';
      }

      applyWeatherState(state, desc, Math.round(temp));
      
      // Actualizar info en el botón de navegación de Mareas (Solo marea, no clima por petición de usuario)
      /* const navInfo = document.getElementById('nav-mareas-info');
      if (navInfo) {
        navInfo.innerText = `${Math.round(temp)}°C | ${desc}`;
      } */

      const windSpeed = current.data.instant.details.wind_speed * 3.6;
      updateBathingStatus(windSpeed, state);

      const mTemp = document.getElementById('modal-temp');
      const mDesc = document.getElementById('modal-desc');
      const mIcon = document.getElementById('modal-icon-emoji');
      if (mTemp) mTemp.innerText = `${Math.round(temp)}°`;
      if (mDesc) mDesc.innerText = desc;
      if (mIcon) {
        let icon = '☀️';
        if (state === 'rain') icon = '🌧️';
        else if (state === 'thunder') icon = '⛈️';
        else if (state === 'cloudy') icon = '🌥️';
        mIcon.innerText = icon;
      }

      const vientoEl = document.getElementById('val-viento');
      const humedadEl = document.getElementById('val-humedad');
      const uvEl = document.getElementById('val-uv');
      if (vientoEl) vientoEl.innerText = `${Math.round(current.data.instant.details.wind_speed * 3.6)} km/h`;
      if (humedadEl) humedadEl.innerText = `${Math.round(current.data.instant.details.relative_humidity)}%`;
      if (uvEl) {
        const uvIndex = current.data.instant.details.ultraviolet_index_clear_sky;
        uvEl.innerText = uvIndex !== undefined ? (uvIndex < 3 ? "Bajo" : uvIndex < 6 ? "Medio" : "Alto") : "Medio";
      }

      const hourlyList = document.getElementById('hourly-list');
      if (hourlyList) {
        let hHtml = '';
        for (let i = 0; i < 12; i++) {
          const hEntry = data.properties.timeseries[i];
          if (!hEntry) continue;
          const hTime = new Date(hEntry.time);
          const hTemp = Math.round(hEntry.data.instant.details.air_temperature);
          const hSym = hEntry.data.next_1_hours?.summary.symbol_code || "fair_day";
          let hIcon = '☀️';
          if (hSym.includes('rain')) hIcon = '🌧️';
          else if (hSym.includes('cloud')) hIcon = '🌥️';

          hHtml += `
            <div class="hourly-item ${i === 0 ? 'active' : ''}">
              <span class="time">${hTime.getHours()}:00</span>
              <span style="font-size:20px;">${hIcon}</span>
              <span class="temp">${hTemp}°</span>
            </div>
          `;
        }
        hourlyList.innerHTML = hHtml;
      }

      const dailyList = document.getElementById('daily-list');
      if (dailyList) {
        let dHtml = '';
        const dailyIndices = [24, 48, 72, 96];
        dailyIndices.forEach(idx => {
          const dEntry = data.properties.timeseries[idx];
          if (dEntry) {
            const dDate = new Date(dEntry.time);
            const dTemp = Math.round(dEntry.data.instant.details.air_temperature);
            const dSym = dEntry.data.next_6_hours?.summary.symbol_code || "fair_day";
            const dayName = dDate.toLocaleDateString('es-ES', { weekday: 'short' });
            let dIcon = '☀️';
            if (dSym.includes('rain')) dIcon = '🌧️';
            else if (dSym.includes('cloud')) dIcon = '🌥️';

            dHtml += `
              <div class="daily-item">
                <span class="day">${dayName}</span>
                <span style="font-size:24px;">${dIcon}</span>
                <span class="temp">${dTemp}°</span>
              </div>
            `;
          }
        });
        dailyList.innerHTML = dHtml;
      }

      const updatedEl = document.getElementById('weather-updated');
      if (updatedEl) {
        const now = new Date();
        updatedEl.innerText = `Actualizado: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      }
    } catch (e) {
      console.error("Fallo al actualizar el clima:", e);
      applyWeatherState('cloudy', 'Error de conexión', '--');
    }
  };


  // --- 8. Lógica Climática Avanzada ---
  const setupDragScroll = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    let isDown = false;
    let startX: number;
    let scrollLeft: number;

    el.addEventListener('mousedown', (e) => {
      isDown = true;
      el.classList.add('active');
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
      el.style.cursor = 'grabbing';
    });
    el.addEventListener('mouseleave', () => {
      isDown = false;
      el.style.cursor = 'grab';
    });
    el.addEventListener('mouseup', () => {
      isDown = false;
      el.style.cursor = 'grab';
    });
    el.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 2;
      el.scrollLeft = scrollLeft - walk;
    });
  };

  setupDragScroll('hourly-list');
  setupDragScroll('daily-list');

  const weatherDetailsModal = document.getElementById('weather-details-modal') as HTMLElement;
  const btnCloseWeather = document.getElementById('btn-close-weather') as HTMLElement;

  const closeWeatherModal = () => weatherDetailsModal.classList.add('hidden');
  if (btnCloseWeather) btnCloseWeather.onclick = closeWeatherModal;

  // Cerrar modal al tocar el backdrop (fondo oscuro)
  const closeOnBackdrop = (modal: HTMLElement, closeFn: () => void) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeFn();
      }
    });
  };

  closeOnBackdrop(weatherDetailsModal, closeWeatherModal);
  closeOnBackdrop(adminModal, () => adminModal.classList.add('hidden'));
  closeOnBackdrop(eventsModal, () => eventsModal.classList.add('hidden'));

  const triggerFunnyState = () => {
    if (weatherWidget.classList.contains('extreme')) return;
    
    weatherWidget.classList.add('funny');
    // Generar algunas partículas de alegría
    for(let i=0; i<5; i++) {
      setTimeout(() => createParticle(Math.random() > 0.5 ? 'heart' : 'sparkle'), i * 100);
    }
    
    setTimeout(() => {
      weatherWidget.classList.remove('funny');
    }, 3000);
  };

  weatherWidget.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerFunnyState();
    // openWeatherModal eliminado por petición del usuario
  });

  weatherWidget.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerFunnyState();
    // openWeatherModal eliminado por petición del usuario
  });

  // Lógica de cambio de pestañas
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = (btn as HTMLElement).dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`)?.classList.add('active');
    });
  });

  // Cerrar bottom sheet al tocar en el mapa
  map.on('click', () => {
    if (!isAdmin) closeBottomSheet();
  });

  const populateRealTides = async () => {
    const tidesList = document.getElementById('modal-tides-list');
    const tidePath = document.getElementById('tide-path');
    const marker = document.getElementById('tide-now-marker');
    if (!tidesList) return;

    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);

      const tToday = calculateTidesForDate(now);
      const todayHtml = `
        <div class="tide-card active">
          <div class="type">Hoy</div>
          <div class="time">P: ${tToday.high} | B: ${tToday.low}</div>
        </div>
      `;

      // Actualizar info en el botón de navegación eliminado por petición
      /* const navInfo = document.getElementById('nav-mareas-info');
      if (navInfo) {
        navInfo.innerText = `🌊 P: ${tToday.high}`;
      } */

      // Preparar simulación para el gráfico
      const todayHourly: number[] = [];
      const epoch = new Date('2024-04-01T03:00:00').getTime();
      const tideCycle = 12.42;
      for (let h = 0; h < 24; h++) {
        const d = new Date(now); d.setHours(h, 0, 0, 0);
        const diffHours = (d.getTime() - epoch) / (1000 * 60 * 60);
        todayHourly.push(2 + 1.5 * Math.sin((diffHours / tideCycle) * 2 * Math.PI));
      }

      const peaks: { hour: number, val: number, isHigh: boolean }[] = [];
      for (let h = 1; h < 23; h++) {
        if (todayHourly[h] > todayHourly[h - 1] && todayHourly[h] > todayHourly[h + 1]) peaks.push({ hour: h, val: todayHourly[h], isHigh: true });
        if (todayHourly[h] < todayHourly[h - 1] && todayHourly[h] < todayHourly[h + 1]) peaks.push({ hour: h, val: todayHourly[h], isHigh: false });
      }

      const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2);

      const nextDays = [
        { day: 'Mañana', date: tomorrow },
        { day: 'Pasado', date: dayAfter }
      ];

      const nextDaysHtml = nextDays.map(d => {
        const t = calculateTidesForDate(d.date);
        return `
          <div class="tide-card">
            <div class="type">${d.day}</div>
            <div class="time">P: ${t.high} | B: ${t.low}</div>
          </div>
        `;
      }).join('');

      tidesList.innerHTML = todayHtml + nextDaysHtml;

      // Dibujo del gráfico
      const labelLayer = document.getElementById('tide-labels-layer');
      if (tidePath && labelLayer) {
        labelLayer.innerHTML = ''; // Limpiar etiquetas antiguas
        const values = todayHourly;
        const max = Math.max(...values);
        const min = Math.min(...values);
        const range = (max - min) || 1;

        let pathData = "M 0 50";
        const points: { x: number, y: number, v: number, h: number }[] = [];

        values.forEach((v: number, i: number) => {
          const x = (i / 23) * 100;
          const y = 50 - ((v - min) / range) * 35 - 8; // Ajustar para que quepa en el viewbox 0-50
          pathData += ` L ${x} ${y}`;
          points.push({ x, y, v, h: i });

          // Dibujar marcadores de tiempo (0, 6, 12, 18, 23)
          if (i % 6 === 0 || i === 23) {
            const timeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            timeText.setAttribute("x", x.toString());
            timeText.setAttribute("y", "58");
            timeText.setAttribute("text-anchor", "middle");
            timeText.setAttribute("font-size", "3.5");
            timeText.textContent = `${i}:00`;
            labelLayer.appendChild(timeText);

            const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            vLine.setAttribute("x1", x.toString()); vLine.setAttribute("y1", "48");
            vLine.setAttribute("x2", x.toString()); vLine.setAttribute("y2", "50");
            vLine.setAttribute("stroke", "#e2e8f0"); vLine.setAttribute("stroke-width", "0.3");
            labelLayer.appendChild(vLine);
          }
        });
        pathData += " L 100 50 Z";
        tidePath.setAttribute('d', pathData);

        // Resaltar Picos en el gráfico
        peaks.forEach(p => {
          const pt = points[p.hour];
          if (pt) {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", pt.x.toString());
            circle.setAttribute("cy", pt.y.toString());
            circle.setAttribute("r", "1.5");
            circle.setAttribute("fill", p.isHigh ? "#2563eb" : "#d97706");
            circle.setAttribute("stroke", "white");
            circle.setAttribute("stroke-width", "0.5");
            labelLayer.appendChild(circle);

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", pt.x.toString());
            text.setAttribute("y", (pt.y - (p.isHigh ? 4 : -7)).toString());
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("font-size", "3");
            text.setAttribute("fill", p.isHigh ? "#1e40af" : "#92400e");
            text.textContent = `${p.val.toFixed(2)}m`;
            labelLayer.appendChild(text);
          }
        });

        if (marker) {
          const nowTime = new Date();
          const currentProgress = (nowTime.getHours() * 60 + nowTime.getMinutes()) / (24 * 60);
          const xNow = currentProgress * 100;
          marker.setAttribute('x1', xNow.toString());
          marker.setAttribute('x2', xNow.toString());
          marker.style.display = 'block';
        }
      }

    } catch (e) {
      console.error("Mareas Error Final:", e);
      tidesList.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 20px;">
          <p style="font-size:12px; color:#ef4444; margin-bottom:10px;">No se pudo conectar con el servicio de mareas.</p>
          <button onclick="window.location.reload()" style="background:#2563eb; color:white; border:none; padding:8px 16px; border-radius:20px; font-size:11px;">Reintentar</button>
        </div>
      `;
    }
  };
  loadPOIs();
  renderMarkers();
  fetchRealWeather();
  populateRealTides();
  
  if (weatherFetchInterval) clearInterval(weatherFetchInterval);
  weatherFetchInterval = window.setInterval(() => {
    fetchRealWeather();
    populateRealTides();
  }, 60 * 60 * 1000);

  window.addEventListener('beforeunload', () => {
    if (weatherInterval) clearInterval(weatherInterval);
    if (weatherFetchInterval) clearInterval(weatherFetchInterval);
    if (extremeTimeout) clearTimeout(extremeTimeout);
  });
});
