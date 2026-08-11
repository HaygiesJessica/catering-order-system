'use strict';

const MENU = [
  { id: 'm01', category: 'Appetizers',       name: 'Chicken Fillet',           desc: 'Crispy breaded chicken pieces with dip.',        price: 320,  unit: 'tray · 12 pcs',        img: '/img/chicken-fillet.jpg' },
  { id: 'm02', category: 'Appetizers',       name: 'Filipino BBQ Skewers',     desc: 'Sweet and savory grilled meat skewers.',         price: 380,  unit: 'tray · 10 sticks',     img: '/img/bbq-skewers.jpg' },
  { id: 'm03', category: 'Appetizers',       name: 'Lumpiang Shanghai',        desc: 'Crispy pork-filled spring rolls.',               price: 280,  unit: 'tray · 20 pcs',        img: '/img/lumpiang-shanghai.jpg' },
  { id: 'm04', category: 'Appetizers',       name: "Tokwa't Baboy",            desc: 'Fried tofu and pork in soy-vinegar.',            price: 260,  unit: 'bowl · ~10 guests',    img: '/img/tokwat-baboy.jpg' },
  { id: 'm05', category: 'Appetizers',       name: 'Ukoy na Hipon',            desc: 'Crunchy shrimp and sweet potato fritters.',      price: 350,  unit: 'tray · 12 pcs',        img: '/img/ukoy-na-hipon.jpg' },
  { id: 'm06', category: 'Mains',            name: 'Beef Kare-Kare',           desc: 'Oxtail stew in rich peanut sauce.',              price: 1450, unit: 'pan · ~10 guests',     img: '/img/beef-kare-kare.jpg' },
  { id: 'm07', category: 'Mains',            name: 'Chicken Inasal',           desc: 'Smokey lemongrass-marinated grilled chicken.',   price: 980,  unit: 'tray · 10 pcs',        img: '/img/chicken-inasal.jpg' },
  { id: 'm08', category: 'Mains',            name: 'Crispy Pata',              desc: 'Deep-fried whole pork leg.',                     price: 1250, unit: 'whole · ~8 guests',    img: '/img/crispy-pata.jpg' },
  { id: 'm09', category: 'Mains',            name: 'Pork Bistek Tagalog',      desc: 'Braised pork with caramelized onions.',          price: 890,  unit: 'pan · ~10 guests',     img: '/img/pork-bistek.jpg' },
  { id: 'm10', category: 'Mains',            name: 'Pork Sisig',               desc: 'Sizzling chopped pork with onions and chili.',   price: 750,  unit: 'sizzling plate · ~8',  img: '/img/pork-sisig.jpg' },
  { id: 'm11', category: 'Pasta and Noodles',name: 'Filipino Carbonara',       desc: 'Creamy pasta with hot dogs and ham.',            price: 620,  unit: 'bilao · ~10 guests',   img: '/img/filipino-carbonara.jpg' },
  { id: 'm12', category: 'Pasta and Noodles',name: 'Filipino Sweet Spaghetti', desc: 'Sweet tomato sauce with sliced hot dogs.',       price: 550,  unit: 'bilao · ~10 guests',   img: '/img/sweet-spaghetti.jpg' },
  { id: 'm13', category: 'Pasta and Noodles',name: 'Pancit Bihon Guisado',     desc: 'Stir-fried thin rice noodles with meat.',        price: 680,  unit: 'bilao · ~10 guests',   img: '/img/pancit-bihon.jpg' },
  { id: 'm14', category: 'Pasta and Noodles',name: 'Pancit Canton',            desc: 'Stir-fried wheat noodles with vegetables.',      price: 640,  unit: 'bilao · ~10 guests',   img: '/img/pancit-canton.jpg' },
  { id: 'm15', category: 'Pasta and Noodles',name: 'Pancit Palabok',           desc: 'Noodles in savory shrimp sauce.',                price: 720,  unit: 'bilao · ~10 guests',   img: '/img/pancit-palabok.jpg' },
  { id: 'm16', category: 'Veggies',          name: 'Chopsuey',                 desc: 'Stir-fried mixed vegetables in garlic sauce.',   price: 420,  unit: 'bowl · ~10 guests',    img: '/img/chopsuey.jpg' },
  { id: 'm17', category: 'Veggies',          name: 'Gising Gising',            desc: 'Spicy green beans in coconut milk.',             price: 380,  unit: 'bowl · ~10 guests',    img: '/img/gising-gising.jpg' },
  { id: 'm18', category: 'Veggies',          name: 'Lumpiang Sariwa',          desc: 'Fresh vegetable spring roll with sauce.',        price: 350,  unit: 'tray · 10 pcs',        img: '/img/lumpiang-sariwa.jpg' },
  { id: 'm19', category: 'Veggies',          name: 'Pinakbet',                 desc: 'Mixed vegetables simmered in bagoong.',          price: 390,  unit: 'bowl · ~10 guests',    img: '/img/pinakbet.jpg' },
  { id: 'm20', category: 'Veggies',          name: 'Sipo Egg',                 desc: 'Quail eggs and vegetables in cream.',            price: 410,  unit: 'bowl · ~10 guests',    img: '/img/sipo-egg.jpg' },
  { id: 'm21', category: 'Desserts',         name: 'Buko Pandan',              desc: 'Young coconut and pandan jelly in cream.',       price: 450,  unit: 'bowl · ~10 guests',    img: '/img/buko-pandan.jpg' },
  { id: 'm22', category: 'Desserts',         name: 'Coffee Jelly',             desc: 'Coffee gelatin cubes in sweet cream.',           price: 420,  unit: 'tray · 10 cups',       img: '/img/coffee-jelly.jpg' },
  { id: 'm23', category: 'Desserts',         name: 'Fruit Salad',              desc: 'Tropical fruits mixed with rich cream.',         price: 480,  unit: 'bowl · ~10 guests',    img: '/img/fruit-salad.jpg' },
  { id: 'm24', category: 'Desserts',         name: 'Leche Flan',               desc: 'Rich caramel custard dessert.',                  price: 520,  unit: 'whole · 10 slices',    img: '/img/leche-flan.jpg' },
  { id: 'm25', category: 'Desserts',         name: 'Mango Graham',             desc: 'Layered graham, cream, and mango cake.',         price: 550,  unit: 'whole · 10 slices',    img: '/img/mango-graham.jpg' }
];

const EVENT_TYPES = [
  'Wedding', 'Birthday', 'Corporate lunch', 'Family reunion', 'Garden party', 'Private event'
];

const FEES = { serviceRate: 0.12, deliveryFee: 250, freeDeliveryOver: 5000 };

module.exports = { MENU, EVENT_TYPES, FEES };