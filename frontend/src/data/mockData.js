// ============================================================
// MOCK DATA — realistic demo data for all pages
// ============================================================

export const CATEGORIES = [
  { id: 'electronics',  name: 'Electronics',    slug: 'electronics',  icon: '📱', color: '#2563eb', bg: '#dbeafe' },
  { id: 'fashion',      name: 'Fashion',         slug: 'fashion',      icon: '👗', color: '#7c3aed', bg: '#ede9fe' },
  { id: 'home',         name: 'Home & Garden',   slug: 'home',         icon: '🏠', color: '#059669', bg: '#d1fae5' },
  { id: 'sports',       name: 'Sports',          slug: 'sports',       icon: '⚽', color: '#d97706', bg: '#fef3c7' },
  { id: 'books',        name: 'Books',           slug: 'books',        icon: '📚', color: '#dc2626', bg: '#fee2e2' },
  { id: 'beauty',       name: 'Beauty',          slug: 'beauty',       icon: '💄', color: '#db2777', bg: '#fce7f3' },
  { id: 'toys',         name: 'Toys & Games',    slug: 'toys',         icon: '🎮', color: '#16a34a', bg: '#dcfce7' },
  { id: 'automotive',   name: 'Automotive',      slug: 'automotive',   icon: '🚗', color: '#475569', bg: '#f1f5f9' },
]

export const PRODUCTS = [
  {
    id: 'p1',
    title: 'Apple AirPods Pro (2nd Generation) — Active Noise Cancellation',
    price: 189.99,
    originalPrice: 249.99,
    rating: 4.7,
    reviewCount: 87432,
    category: 'electronics',
    provider: { id: 'pv1', name: 'TechStore Official' },
    images: [
      'https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=600&q=80',
      'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&q=80',
    ],
    stock: 124,
    badge: 'deal',
    badgeText: '-24%',
    isNew: false,
    tags: ['wireless', 'noise-cancelling', 'bluetooth'],
    specs: { Brand: 'Apple', 'Battery Life': '6h + 30h case', 'Chip': 'H2', 'Connectivity': 'Bluetooth 5.3', Color: 'White' },
    description: 'The Apple AirPods Pro (2nd generation) feature up to 2x more Active Noise Cancellation than the previous generation, along with Transparency mode and Personalized Spatial Audio with dynamic head tracking.',
  },
  {
    id: 'p2',
    title: 'Samsung Galaxy S24 Ultra 5G — 256GB, Titanium Black',
    price: 1099.99,
    originalPrice: 1299.99,
    rating: 4.6,
    reviewCount: 34521,
    category: 'electronics',
    provider: { id: 'pv1', name: 'TechStore Official' },
    images: [
      'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&q=80',
    ],
    stock: 48,
    badge: 'deal',
    badgeText: '-15%',
    isNew: false,
    tags: ['smartphone', '5g', 'samsung'],
    specs: { Brand: 'Samsung', Display: '6.8" QHD+', 'RAM': '12GB', Storage: '256GB', Battery: '5000mAh', OS: 'Android 14' },
    description: 'The ultimate smartphone experience with the integrated S Pen, 200MP camera, and titanium frame.',
  },
  {
    id: 'p3',
    title: 'Nike Air Max 270 React — Men\'s Running Shoes',
    price: 89.99,
    originalPrice: 130.00,
    rating: 4.5,
    reviewCount: 12089,
    category: 'sports',
    provider: { id: 'pv2', name: 'SportZone Marketplace' },
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
    ],
    stock: 238,
    badge: 'deal',
    badgeText: '-31%',
    isNew: false,
    tags: ['nike', 'running', 'shoes'],
    specs: { Brand: 'Nike', Model: 'Air Max 270 React', Gender: 'Men', Sizes: '7-13 US', Material: 'Mesh + Foam' },
    description: 'Lightweight running shoe with revolutionary Air cushioning and React foam midsole for an incredibly smooth ride.',
  },
  {
    id: 'p4',
    title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    price: 278.00,
    originalPrice: 399.99,
    rating: 4.8,
    reviewCount: 52311,
    category: 'electronics',
    provider: { id: 'pv1', name: 'TechStore Official' },
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80',
    ],
    stock: 72,
    badge: null,
    isNew: false,
    tags: ['headphones', 'sony', 'noise-cancelling'],
    specs: { Brand: 'Sony', 'Battery Life': '30h', 'Driver Size': '30mm', 'Connectivity': 'Bluetooth 5.2', Weight: '250g' },
    description: 'Industry-leading noise cancellation with exceptional sound quality. Two processors control eight microphones for best-in-class noise cancellation.',
  },
  {
    id: 'p5',
    title: 'LEGO Technic Bugatti Chiron 42083 Building Kit (3599 Pieces)',
    price: 279.95,
    originalPrice: 349.99,
    rating: 4.9,
    reviewCount: 9832,
    category: 'toys',
    provider: { id: 'pv3', name: 'Toy World Store' },
    images: [
      'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600&q=80',
    ],
    stock: 31,
    badge: 'top',
    badgeText: 'Top Rated',
    isNew: false,
    tags: ['lego', 'technic', 'building'],
    specs: { Brand: 'LEGO', Pieces: '3599', 'Age Range': '16+', Dimensions: '14" x 6"', Model: 'Bugatti Chiron' },
    description: 'Build the 1:8 scale model of the legendary Bugatti Chiron, with a working W16 engine, adjustable spoiler, and 4WD system.',
  },
  {
    id: 'p6',
    title: 'Kindle Paperwhite (16 GB) — The thinnest, lightest Kindle',
    price: 99.99,
    originalPrice: 139.99,
    rating: 4.7,
    reviewCount: 128903,
    category: 'electronics',
    provider: { id: 'pv4', name: 'Digital Reads' },
    images: [
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&q=80',
    ],
    stock: 450,
    badge: null,
    isNew: true,
    tags: ['kindle', 'ebook', 'reader'],
    specs: { Brand: 'Amazon', Storage: '16GB', Display: '6.8" Paperwhite', 'Waterproof': 'IPX8', Battery: '12 weeks' },
    description: '6.8" display with adjustable warm light, 3-month free Kindle Unlimited offer included.',
  },
  {
    id: 'p7',
    title: 'Dyson V15 Detect Absolute Cordless Vacuum Cleaner',
    price: 599.99,
    originalPrice: 749.99,
    rating: 4.6,
    reviewCount: 23451,
    category: 'home',
    provider: { id: 'pv5', name: 'Home Essentials Co.' },
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    ],
    stock: 18,
    badge: 'deal',
    badgeText: '-20%',
    isNew: false,
    tags: ['dyson', 'vacuum', 'cordless'],
    specs: { Brand: 'Dyson', 'Runtime': '60 min', Suction: '240 AW', 'Laser': 'Green Laser Detect', Weight: '3.1kg' },
    description: 'Laser dust detection reveals microscopic dust. Scientifically proven to detect and display particles as small as 10 microns.',
  },
  {
    id: 'p8',
    title: 'L\'Oréal Paris Revitalift 1.5% Pure Hyaluronic Acid Serum',
    price: 24.99,
    originalPrice: 32.99,
    rating: 4.4,
    reviewCount: 67823,
    category: 'beauty',
    provider: { id: 'pv6', name: 'Beauty Hub' },
    images: [
      'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=600&q=80',
    ],
    stock: 892,
    badge: null,
    isNew: false,
    tags: ['skincare', 'serum', 'hyaluronic'],
    specs: { Brand: "L'Oréal", Volume: '30ml', Skin: 'All skin types', Key: '1.5% Hyaluronic Acid' },
    description: 'Concentrated anti-aging serum with 1.5% pure hyaluronic acid to plump and reduce wrinkles.',
  },
  {
    id: 'p9',
    title: 'Atomic Habits — An Easy & Proven Way to Build Good Habits',
    price: 12.59,
    originalPrice: 27.00,
    rating: 4.9,
    reviewCount: 312087,
    category: 'books',
    provider: { id: 'pv4', name: 'Digital Reads' },
    images: [
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80',
    ],
    stock: 1500,
    badge: 'top',
    badgeText: '#1 Bestseller',
    isNew: false,
    tags: ['habits', 'self-help', 'bestseller'],
    specs: { Author: 'James Clear', Pages: '320', Publisher: 'Avery', Language: 'English', Format: 'Paperback' },
    description: 'The #1 New York Times bestseller. Over 15 million copies sold. Tiny Changes, Remarkable Results.',
  },
  {
    id: 'p10',
    title: 'MacBook Air M3 Chip (13-inch, 8GB RAM, 256GB SSD)',
    price: 1099.00,
    originalPrice: 1299.00,
    rating: 4.8,
    reviewCount: 42301,
    category: 'electronics',
    provider: { id: 'pv1', name: 'TechStore Official' },
    images: [
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80',
    ],
    stock: 55,
    badge: null,
    isNew: true,
    tags: ['macbook', 'apple', 'laptop'],
    specs: { Brand: 'Apple', Chip: 'M3', RAM: '8GB', Storage: '256GB SSD', Display: '13.6" Liquid Retina', Battery: '18h' },
    description: 'Supercharged by the M3 chip. Up to 18 hours of battery life, 2x faster than M1. Available in Midnight, Starlight, Space Gray.',
  },
  {
    id: 'p11',
    title: 'Adidas Ultraboost 23 Running Shoes — Women\'s',
    price: 109.95,
    originalPrice: 190.00,
    rating: 4.5,
    reviewCount: 8934,
    category: 'sports',
    provider: { id: 'pv2', name: 'SportZone Marketplace' },
    images: [
      'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&q=80',
    ],
    stock: 145,
    badge: 'deal',
    badgeText: '-42%',
    isNew: false,
    tags: ['adidas', 'running', 'shoes'],
    specs: { Brand: 'Adidas', Model: 'Ultraboost 23', Gender: 'Women', Midsole: 'BOOST foam', Drop: '10mm' },
    description: 'Experience extraordinary energy return with every step. BOOST midsole and PRIMEKNIT+ upper.',
  },
  {
    id: 'p12',
    title: 'IKEA KALLAX Shelf Unit — White, 77x147cm',
    price: 159.99,
    originalPrice: null,
    rating: 4.3,
    reviewCount: 45612,
    category: 'home',
    provider: { id: 'pv5', name: 'Home Essentials Co.' },
    images: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
    ],
    stock: 67,
    badge: null,
    isNew: false,
    tags: ['ikea', 'shelf', 'storage'],
    specs: { Brand: 'IKEA', Series: 'KALLAX', Dimensions: '77x147cm', Material: 'Particleboard', Load: '13kg/shelf' },
    description: 'Versatile shelf unit that can stand on the floor or be wall-mounted, with many optional insert accessories.',
  },
]

export const BANNER_SLIDES = [
  {
    id: 1,
    tag: 'Limited Time Offer',
    title: 'Electronics Sale',
    subtitle: 'Up to 40% off on top brands. Deals expire midnight.',
    cta: 'Shop Electronics',
    ctaLink: '/category/electronics',
    bg: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
    accent: '#FF9900',
  },
  {
    id: 2,
    tag: 'New Arrivals',
    title: 'Summer Fashion 2026',
    subtitle: 'Discover the season\'s hottest trends from top providers.',
    cta: 'Explore Fashion',
    ctaLink: '/category/fashion',
    bg: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
    accent: '#e94560',
  },
  {
    id: 3,
    tag: 'AI Recommended',
    title: 'Picked Just For You',
    subtitle: 'Our DeepFM engine has found products you\'ll love.',
    cta: 'See Recommendations',
    ctaLink: '/recommendations',
    bg: 'linear-gradient(135deg, #0a0a0a, #1a1a1a, #2d1b69)',
    accent: '#7c3aed',
  },
]

export const ORDERS = [
  {
    id: 'ORD-2026-001',
    date: '2026-06-25',
    status: 'Delivered',
    total: 289.98,
    items: [PRODUCTS[0], PRODUCTS[5]],
    tracking: 'TRK987654321',
    timeline: [
      { label: 'Order Placed',    done: true,    time: 'Jun 25, 10:00 AM' },
      { label: 'Payment Confirmed', done: true,  time: 'Jun 25, 10:02 AM' },
      { label: 'Preparing',       done: true,    time: 'Jun 25, 2:00 PM' },
      { label: 'Shipped',         done: true,    time: 'Jun 26, 9:00 AM' },
      { label: 'Delivered',       done: true,    time: 'Jun 27, 3:45 PM' },
    ]
  },
  {
    id: 'ORD-2026-002',
    date: '2026-06-28',
    status: 'Shipped',
    total: 89.99,
    items: [PRODUCTS[2]],
    tracking: 'TRK123456789',
    timeline: [
      { label: 'Order Placed',    done: true,    time: 'Jun 28, 9:00 AM' },
      { label: 'Payment Confirmed', done: true,  time: 'Jun 28, 9:01 AM' },
      { label: 'Preparing',       done: true,    time: 'Jun 28, 4:00 PM' },
      { label: 'Shipped',         done: true,    time: 'Jun 29, 10:00 AM' },
      { label: 'Delivered',       done: false,   time: 'Expected Jul 1' },
    ]
  },
  {
    id: 'ORD-2026-003',
    date: '2026-06-30',
    status: 'Pending',
    total: 1099.99,
    items: [PRODUCTS[1]],
    tracking: null,
    timeline: [
      { label: 'Order Placed',    done: true,    time: 'Jun 30, 7:00 PM' },
      { label: 'Payment Confirmed', done: true,  time: 'Jun 30, 7:01 PM' },
      { label: 'Preparing',       done: false,   time: 'Estimated tomorrow' },
      { label: 'Shipped',         done: false,   time: '—' },
      { label: 'Delivered',       done: false,   time: '—' },
    ]
  },
]

export const REVIEWS = [
  { id: 'r1', author: 'James W.', rating: 5, title: 'Absolutely love these!', body: 'Best earbuds I\'ve ever owned. The noise cancellation is incredible and battery life is solid. Highly recommend to anyone looking for premium wireless earbuds.', date: 'Jun 12, 2026', helpful: 234 },
  { id: 'r2', author: 'Maria S.', rating: 4, title: 'Great product, minor fit issue', body: 'Sound quality is fantastic and ANC works brilliantly on planes. Docked one star because the ear tips could be better shaped for smaller ears.', date: 'May 28, 2026', helpful: 89 },
  { id: 'r3', author: 'Tom K.',   rating: 5, title: 'Worth every penny', body: 'Coming from the 1st gen, the improvements are massive. The new H2 chip makes a huge difference in ANC quality. Buy them.', date: 'May 15, 2026', helpful: 156 },
  { id: 'r4', author: 'Anh N.',   rating: 3, title: 'Good but pricey', body: 'The sound is great and ANC is solid. My only complaint is the price is steep compared to competitors offering similar features at lower cost.', date: 'Apr 20, 2026', helpful: 41 },
]

export const PROVIDER_STATS = {
  revenue: { value: '$24,891', trend: '+18.3%', up: true },
  orders:  { value: '342',    trend: '+24 today', up: true },
  products:{ value: '67',     trend: '3 low stock', up: false },
  rating:  { value: '4.72★',  trend: '+0.1 this month', up: true },
}

export const ADMIN_STATS = {
  revenue:  { value: '$184,293', trend: '+12% vs last month', up: true },
  orders:   { value: '5,621',   trend: '+8% vs last month', up: true },
  users:    { value: '23,450',  trend: '+342 today', up: true },
  pending:  { value: '7',       trend: 'provider applications', up: false },
}

export const PROVIDER_APPLICATIONS = [
  { id: 'app1', name: 'Minh Tuan Nguyen', store: 'TechGadgets VN', email: 'minh@techgadgetsvn.com', category: 'Electronics', submitted: '2026-06-29', status: 'PENDING', description: 'We sell consumer electronics and accessories imported directly from Korea and Japan.' },
  { id: 'app2', name: 'Sarah Johnson', store: 'Bloom Beauty Co.', email: 'sarah@bloombeauty.co', category: 'Beauty', submitted: '2026-06-28', status: 'PENDING', description: 'Organic skincare and beauty products, handmade in small batches.' },
  { id: 'app3', name: 'Duc Le', store: 'Sports & Fit', email: 'duc@sportsfit.vn', category: 'Sports', submitted: '2026-06-27', status: 'APPROVED', description: 'Fitness equipment and sportswear for Vietnamese athletes.' },
  { id: 'app4', name: 'Anna Chen', store: 'HomeCraft Studio', email: 'anna@homecraftstudio.com', category: 'Home', submitted: '2026-06-26', status: 'REJECTED', description: 'Handmade home decor and furniture.' },
  { id: 'app5', name: 'Raj Patel', store: 'Book Paradise', email: 'raj@bookparadise.in', category: 'Books', submitted: '2026-06-25', status: 'PENDING', description: 'Textbooks, novels, and educational materials at competitive prices.' },
]

export const ALL_USERS = [
  { id: 'u1', name: 'Alex Thompson', email: 'alex@example.com', role: 'CUSTOMER', status: 'ACTIVE', orders: 14, joined: '2026-01-15' },
  { id: 'u2', name: 'TechStore Official', email: 'tech@store.com', role: 'PROVIDER', status: 'ACTIVE', orders: 0, joined: '2025-12-01' },
  { id: 'u3', name: 'Maria Santos', email: 'maria@example.com', role: 'CUSTOMER', status: 'ACTIVE', orders: 7, joined: '2026-03-20' },
  { id: 'u4', name: 'David Kim', email: 'david@example.com', role: 'CUSTOMER', status: 'SUSPENDED', orders: 2, joined: '2026-05-11' },
  { id: 'u5', name: 'SportZone Marketplace', email: 'sports@zone.com', role: 'PROVIDER', status: 'ACTIVE', orders: 0, joined: '2026-02-14' },
]

export const REVENUE_DATA = [
  { month: 'Jan', revenue: 18400, orders: 312 },
  { month: 'Feb', revenue: 22100, orders: 389 },
  { month: 'Mar', revenue: 19800, orders: 341 },
  { month: 'Apr', revenue: 28500, orders: 467 },
  { month: 'May', revenue: 31200, orders: 521 },
  { month: 'Jun', revenue: 29800, orders: 498 },
]

export function getProduct(id) { return PRODUCTS.find(p => p.id === id) || null }
export function getProductsByCategory(cat) { return PRODUCTS.filter(p => p.category === cat) }
export function searchProducts(query) {
  if (!query) return PRODUCTS
  const q = query.toLowerCase()
  return PRODUCTS.filter(p =>
    p.title.toLowerCase().includes(q) ||
    p.tags.some(t => t.includes(q)) ||
    p.category.includes(q)
  )
}
export function getRecommended() { return [...PRODUCTS].sort(() => Math.random() - 0.5).slice(0, 8) }
export function getTrending()    { return [...PRODUCTS].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 8) }
export function getDeals()       { return PRODUCTS.filter(p => p.badge === 'deal') }
