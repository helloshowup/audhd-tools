// Clickable body figure. Coordinates are for a 200 x 440 drawing.
// Each shape is drawn on the viewer's left half; "mirror" copies it to the right half.
// "deep" marks muscles that sit under other muscles; they are drawn with a dashed outline.
// Every muscle name here must match a muscle name in data/catalogue.json (the app checks this on load).

export const figureWidth = 200;
export const figureHeight = 440;

// Left half of the body outline, top centre of the neck round to the crotch.
export const bodyOutlineLeftHalf = [
  [100, 50], [90, 50], [88, 62], [72, 68], [54, 72], [44, 82], [40, 100], [36, 130], [34, 155],
  [28, 190], [26, 232], [24, 250], [28, 268], [40, 270], [46, 252], [48, 234], [52, 200], [56, 160],
  [58, 130], [60, 110], [62, 140], [64, 180], [62, 205], [60, 240], [62, 300], [66, 335], [64, 360],
  [66, 400], [62, 420], [60, 436], [88, 436], [88, 420], [86, 404], [90, 360], [90, 336], [96, 280],
  [98, 232], [100, 228],
];
export const head = { cx: 100, cy: 30, rx: 17, ry: 21 };

const shape = (muscle, points, options = {}) => ({ muscle, points, mirror: options.mirror ?? true, deep: options.deep ?? false });

// Order matters: later shapes sit on top of earlier ones.
export const figureShapes = {
  front: [
    shape("Traps", [[88, 60], [72, 68], [86, 70], [92, 64]]),
    shape("Side of neck", [[89, 48], [93, 48], [98, 68], [94, 69]]),
    shape("Deep front of neck", [[95, 51], [100, 51], [100, 66], [95, 66]], { deep: true }),
    shape("Shoulders", [[54, 72], [70, 69], [66, 84], [60, 104], [46, 104], [42, 88]]),
    shape("Chest", [[70, 72], [98, 76], [98, 112], [84, 116], [68, 108], [62, 100], [66, 84]]),
    shape("Small chest muscle", [[72, 82], [84, 84], [82, 98], [74, 96]], { deep: true }),
    shape("Obliques", [[72, 118], [86, 118], [85, 160], [88, 200], [78, 206], [68, 184], [66, 145]]),
    shape("Boxer's muscle", [[63, 112], [72, 114], [74, 140], [64, 140]]),
    shape("Front of shoulder blade", [[60, 100], [66, 104], [66, 116], [61, 114]], { deep: true }),
    shape("Six-pack", [[88, 118], [99, 118], [99, 200], [90, 200], [87, 160]]),
    shape("Deep belly corset", [[76, 166], [86, 168], [87, 194], [80, 198], [74, 184]], { deep: true }),
    shape("Biceps", [[46, 106], [60, 106], [58, 148], [50, 152], [44, 130]]),
    shape("Under the biceps", [[38, 128], [44, 130], [48, 152], [40, 154]]),
    shape("Top of the forearm", [[34, 156], [44, 154], [40, 186], [30, 186]]),
    shape("Inner forearm", [[44, 156], [56, 160], [50, 214], [36, 214], [40, 186]]),
    shape("Forearm twisters", [[48, 160], [55, 162], [52, 176], [46, 172]], { deep: true }),
    shape("Hand", [[27, 236], [47, 236], [45, 262], [38, 268], [28, 262]]),
    shape("Hip flexors", [[82, 208], [94, 210], [93, 228], [84, 224]]),
    shape("Hip pocket muscle", [[63, 204], [72, 202], [72, 226], [63, 230]]),
    shape("Quads", [[64, 230], [82, 224], [92, 236], [94, 290], [88, 330], [70, 332], [62, 290]]),
    shape("Inner thigh", [[92, 232], [98, 232], [98, 268], [94, 292], [92, 256]]),
    shape("Tailor's muscle", [[71, 212], [77, 212], [95, 322], [89, 326]]),
    shape("Outer shin", [[65, 348], [70, 348], [72, 400], [67, 400]]),
    shape("Shin", [[71, 344], [79, 344], [79, 404], [74, 404]]),
    shape("Calves", [[81, 346], [89, 346], [87, 382], [82, 384]]),
    shape("Foot arch", [[64, 420], [86, 420], [88, 435], [60, 435]]),
  ],
  back: [
    shape("Back of neck", [[92, 46], [99, 46], [99, 62], [91, 62]]),
    shape("Traps", [[91, 62], [99, 62], [99, 140], [92, 126], [84, 100], [78, 86], [60, 74], [74, 68], [88, 64]]),
    shape("Shoulder blade lifter", [[88, 54], [92, 54], [84, 72], [80, 70]], { deep: true }),
    shape("Shoulders", [[54, 72], [68, 74], [66, 86], [62, 104], [46, 104], [42, 88]]),
    shape("Top of shoulder blade", [[68, 76], [84, 78], [84, 84], [68, 83]], { deep: true }),
    shape("Back of shoulder blade", [[70, 88], [86, 90], [86, 106], [72, 104]]),
    shape("Small outer rotator", [[63, 96], [71, 98], [72, 106], [64, 106]]),
    shape("Little lat", [[63, 108], [78, 108], [76, 118], [64, 116]]),
    shape("Between the shoulder blades", [[86, 84], [97, 82], [97, 112], [90, 108]], { deep: true }),
    shape("Lats", [[64, 118], [78, 118], [92, 130], [96, 150], [88, 178], [72, 172], [64, 150]]),
    shape("Obliques", [[63, 150], [70, 152], [72, 196], [64, 200]]),
    shape("Lower back", [[90, 140], [96, 140], [96, 206], [88, 206]]),
    shape("Deep spine muscles", [[96, 172], [100, 172], [100, 206], [96, 206]], { deep: true }),
    shape("Side of the lower back", [[80, 176], [88, 176], [88, 198], [80, 196]], { deep: true }),
    shape("Triceps", [[44, 104], [60, 106], [58, 150], [46, 152], [40, 128]]),
    shape("Outer forearm", [[34, 156], [54, 160], [50, 214], [36, 214], [30, 186]]),
    shape("Hand", [[27, 236], [47, 236], [45, 262], [38, 268], [28, 262]]),
    shape("Side glutes", [[64, 202], [86, 200], [88, 214], [68, 222]]),
    shape("Glutes", [[68, 214], [98, 210], [98, 252], [76, 258], [64, 240]]),
    shape("Deep side glutes", [[70, 206], [80, 205], [81, 213], [72, 215]], { deep: true }),
    shape("Deep hip rotators", [[78, 226], [96, 222], [96, 232], [80, 236]], { deep: true }),
    shape("Hamstrings", [[64, 260], [94, 258], [92, 330], [72, 332], [62, 290]]),
    shape("Inner thigh", [[94, 258], [98, 256], [98, 300], [93, 300]]),
    shape("Calves", [[66, 340], [90, 340], [88, 384], [70, 384]]),
    shape("Lower calf", [[68, 384], [89, 384], [86, 404], [71, 404]]),
    shape("Deep calf", [[75, 366], [83, 366], [83, 396], [75, 396]], { deep: true }),
    shape("Foot arch", [[64, 420], [86, 420], [88, 435], [60, 435]]),
  ],
};
