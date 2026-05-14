export interface Evento {
  id: string;
  name: string;
  date: string;
  description: string;
  lat: number;
  lng: number;
  timestamp?: number;
}

export const EVENTS_DATA: Evento[] = [
  { id: 'ev-1', name: 'Reyes / Romería local', date: '6 Enero, 2026', description: 'Cabalgata, ambiente familiar y misa. Tarde tranquila con recogida de caramelos.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-01-06').getTime() },
  { id: 'ev-2', name: 'Trail / Caminata en Cela', date: '19 Enero (Aprox.)', description: 'Evento deportivo de monte en Cela. Carrera por senderos, bosques y costa. Buen ambiente con tapeo.', lat: 42.3420, lng: -8.7900, timestamp: new Date('2026-01-19').getTime() },
  { id: 'ev-3', name: 'Festival de comparsas (Bueu)', date: '20 Febrero, 2026', description: 'Humor, coreografías y crítica en grupos disfrazados. Mucha gente joven y bares llenos.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-02-20').getTime() },
  { id: 'ev-4', name: 'Festival de comparsas (Beluso)', date: '27 Febrero, 2026', description: 'Comparsas del pueblo. Ambiente más «de casa» que en Bueu pero muy animado.', lat: 42.3315, lng: -8.8160, timestamp: new Date('2026-02-27').getTime() },
  { id: 'ev-5', name: 'Entroido (Carnaval)', date: '12-28 Febrero, 2026', description: 'Disfraces por la calle, desfiles, música y fiesta nocturna. De lo mejor del invierno en Bueu.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-02-12').getTime() },
  { id: 'ev-6', name: 'Enterro da Sardiña', date: '18 Febrero, 2026', description: 'Tradicional desfile y entierro simbólico que marca el fin de los días principales del carnaval.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-02-18').getTime() },
  { id: 'ev-7', name: 'Milla da Muller', date: '8-16 Marzo, 2026', description: 'Carreras populares y eventos deportivos por el Día de la Mujer en Bueu. Ambiente familiar.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-03-08').getTime() },
  { id: 'ev-8', name: 'Evento en la Isla de Ons', date: '27 Abril (Aprox.)', description: 'Carrera o ruta de senderismo en la isla. Paisajes espectaculares y planazo de excursión diurna.', lat: 42.3800, lng: -8.9330, timestamp: new Date('2026-04-27').getTime() },
  { id: 'ev-9', name: 'Mes del Pulpo', date: '10-24 Mayo, 2026', description: 'Jornadas gastronómicas en Bueu. Restaurantes ofreciendo pulpo todo el mes, plan perfecto para tapear.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-05-10').getTime() },
  { id: 'ev-10', name: 'Romaría da Ascensión', date: '17 Mayo, 2026', description: 'Celebración tradicional en la Capela dos Santos Reis. Ambiente festivo y romero.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-05-17').getTime() },
  { id: 'ev-11', name: 'Moteros do Morrazo', date: '29 Mayo, 2026', description: 'Concentración motera con rutas por la zona, música y gran ambiente en el puerto.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-05-29').getTime() },
  { id: 'ev-12', name: 'Festas do Corpus de Cela', date: '30 Mayo, 2026', description: 'Celebración con alfombras florales y procesión en la parroquia de Cela.', lat: 42.3420, lng: -8.7900, timestamp: new Date('2026-05-30').getTime() },
  { id: 'ev-13', name: 'Concerto de Verán', date: '8 Junio, 2026', description: 'Concierto al aire libre para dar la bienvenida a la temporada estival en Bueu.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-06-08').getTime() },
  { id: 'ev-14', name: 'San Antonio (Meiro)', date: '13-14 Junio, 2026', description: 'Fiesta típica de parroquia en Meiro. Orquestas, verbena nocturna y muy buen rollo.', lat: 42.3160, lng: -8.7800, timestamp: new Date('2026-06-13').getTime() },
  { id: 'ev-15', name: 'Noche de San Xoán', date: '23 Junio, 2026', description: 'Hogueras en playas, salto de fuego y fiesta fuerte con mucha gente joven.', lat: 42.3315, lng: -8.8160, timestamp: new Date('2026-06-23').getTime() },
  { id: 'ev-16', name: 'Festa do Viño', date: '8 Julio, 2026', description: 'Evento gastronómico en Bueu con vino local, tapas y pequeños conciertos.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-07-08').getTime() },
  { id: 'ev-17', name: 'Virxe do Carme', date: '16 Julio, 2026', description: 'Procesión marítima con barcos, fuegos artificiales y orquestas grandes por la noche.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-07-16').getTime() },
  { id: 'ev-18', name: 'SonRías Baixas', date: '30 Julio - 1 Agosto, 2026', description: 'Festivalazo de música en Bueu. Conciertos potentes, zona food trucks y mucha fiesta.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-07-30').getTime() },
  { id: 'ev-19', name: 'Festa do Polbo', date: '10 Agosto, 2026', description: 'Fiesta del pulpo en Bueu con pasacalles y pulpo á feira en puestos. Gran ambiente.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-08-10').getTime() },
  { id: 'ev-20', name: 'Fiestas de Beluso', date: '14-16 Agosto, 2026', description: 'Fiesta grande local con orquestas potentes (Panorama, etc.). Juegos, pasacalles y verbena.', lat: 42.3315, lng: -8.8160, timestamp: new Date('2026-08-14').getTime() },
  { id: 'ev-21', name: 'FICBUEU', date: '5-20 Septiembre, 2026', description: 'Festival Internacional de Cine en Bueu con proyecciones de cortos y charlas culturales.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-09-05').getTime() },
  { id: 'ev-22', name: 'Festa do Cabalo', date: '16-18 Octubre, 2026', description: 'Exhibiciones de caballos y concurso ecuestre. Tradición curiosa y algo de verbena en Beluso.', lat: 42.3315, lng: -8.8160, timestamp: new Date('2026-10-16').getTime() },
  { id: 'ev-23', name: 'Samaín', date: '31 Octubre, 2026', description: 'Versión gallega de Halloween con calabazas, disfraces, actividades infantiles y fiestas de noche.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-10-31').getTime() },
  { id: 'ev-24', name: 'San Martiño', date: '11 Noviembre, 2026', description: 'Magosto tradicional (castañas y vino). Música y ambiente de pueblo muy típico.', lat: 42.3260, lng: -8.7850, timestamp: new Date('2026-11-11').getTime() }
];
