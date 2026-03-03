import React, { useState, useEffect } from 'react';
import { 
  Instagram, 
  Phone, 
  MessageCircle, 
  Search, 
  ShoppingBag, 
  ChevronRight, 
  ChevronLeft,
  ArrowRight,
  Menu,
  X,
  Star,
  Plus,
  Megaphone,
  ExternalLink
} from 'lucide-react';
import { WheelLogo } from './components/WheelLogo';
import { MultiSpokeLogo } from './components/MultiSpokeLogo';
import { Product, Review, Ad } from './types';
import { motion, AnimatePresence } from 'motion/react';
import AdminDashboard from './components/AdminDashboard';
import { io } from 'socket.io-client';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { supabase } from './services/supabase';

const PHONE_NUMBER = "0993177673";
const WHATSAPP_LINK = `https://wa.me/380993177673`;
const INSTAGRAM_LINK = "https://www.instagram.com/auto_tutanu.ua";

type Tab = 'catalog' | 'reviews' | 'ads';

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('catalog');
  const [showAdModal, setShowAdModal] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newReview, setNewReview] = useState({ user_name: '', rating: 5, comment: '' });

  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'error' | 'not-configured'>('checking');

  useEffect(() => {
    const checkConnection = async () => {
      if (!supabase) {
        setSupabaseStatus('not-configured');
        return;
      }
      try {
        // Test connection by fetching one ID from reviews
        const { error } = await supabase.from('reviews').select('id').limit(1);
        if (error) {
          console.warn('Supabase connection test returned error:', error);
          setSupabaseStatus('error');
        } else {
          console.log('Supabase connection test successful');
          setSupabaseStatus('connected');
        }
      } catch (err) {
        console.error('Supabase connection test failed:', err);
        setSupabaseStatus('error');
      }
    };
    
    checkConnection();
    fetchProducts();
    fetchReviews();
    fetchAds();
    const socket = io();
    return () => { socket.disconnect(); };
  }, []);

  const fetchProducts = async () => {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      console.log('Successfully fetched products from Supabase');
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products from Supabase (using fallback):', error);
      try {
        const res = await fetch('/api/products');
        const data = await res.json();
        setProducts(data || []);
      } catch (localError) {
        console.error('Local API also failed for products:', localError);
        setProducts([]);
      }
    }
  };

  const fetchReviews = async () => {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      console.log('Successfully fetched reviews from Supabase');
      setReviews(data || []);
    } catch (error) {
      console.error('Error fetching reviews from Supabase (using fallback):', error);
      try {
        const res = await fetch('/api/reviews');
        const data = await res.json();
        setReviews(data || []);
      } catch (localError) {
        console.error('Local API also failed for reviews:', localError);
        setReviews([]);
      }
    }
  };

  const fetchAds = async () => {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      console.log('Successfully fetched ads from Supabase');
      setAds(data || []);
    } catch (error) {
      console.error('Error fetching ads from Supabase (using fallback):', error);
      try {
        const res = await fetch('/api/ads');
        const data = await res.json();
        if (data && data.length > 0) {
          setAds(data);
        } else {
          // Add default placeholders if no ads found anywhere
          const placeholders: Ad[] = [
            {
              id: -1,
              title: 'BMW M-Parallel Style 37',
              description: 'Оригінальні диски в ідеальному стані. Параметри: R18, 8J/9.5J.',
              price: 25000,
              phone: '099XXXXXXX',
              images: ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=800'],
              is_placeholder: true,
              created_at: new Date().toISOString()
            },
            {
              id: -2,
              title: 'BBS RS 3-piece forged',
              description: 'Класика, яка ніколи не вийде з моди. Повна реставрація.',
              price: 45000,
              phone: '099XXXXXXX',
              images: ['https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&q=80&w=800'],
              is_placeholder: true,
              created_at: new Date().toISOString()
            },
            {
              id: -3,
              title: 'Vossen CVT Gloss Silver',
              description: 'Сучасний дизайн для вашого авто. Стан нових.',
              price: 18000,
              phone: '099XXXXXXX',
              images: ['https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=800'],
              is_placeholder: true,
              created_at: new Date().toISOString()
            }
          ];
          setAds(placeholders);
        }
      } catch (localError) {
        console.error('Local API also failed:', localError);
        setAds([]);
      }
    }
  };

  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReview(true);
    try {
      let success = false;
      let errorMessage = '';

      // Try Supabase first
      if (supabase) {
        try {
          const { error } = await supabase
            .from('reviews')
            .insert([newReview]);
          
          if (error) throw error;
          success = true;
          console.log('Review successfully added to Supabase');
        } catch (error: any) {
          console.error('Error adding review to Supabase:', error);
          errorMessage = `Supabase Error: ${error.message || JSON.stringify(error)}`;
          
          // Fallback to local API if Supabase fails
          try {
            const res = await fetch('/api/reviews', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newReview)
            });
            if (res.ok) {
              success = true;
              console.log('Review successfully added to local API (fallback)');
            } else {
              const errorData = await res.json();
              errorMessage += ` | Local API Error: ${errorData.error || 'Unknown'}`;
            }
          } catch (localError: any) {
            console.error('Local API also failed:', localError);
            errorMessage += ` | Local API Exception: ${localError.message}`;
          }
        }
      } else {
        // No Supabase, use local API directly
        try {
          const res = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newReview)
          });
          if (res.ok) {
            success = true;
          } else {
            const errorData = await res.json();
            errorMessage = errorData.error || 'Помилка локального сервера';
          }
        } catch (localError: any) {
          console.error('Local API failed:', localError);
          errorMessage = localError.message;
        }
      }

      if (success) {
        alert('Дякуємо! Ваш відгук опубліковано.');
        fetchReviews();
        setShowReviewForm(false);
        setNewReview({ user_name: '', rating: 5, comment: '' });
      } else {
        alert('Не вдалося опублікувати відгук:\n' + errorMessage);
      }
    } catch (error: any) {
      console.error('Error in handleAddReview:', error);
      alert('Виникла непередбачувана помилка');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') { // Simple password for demo
      setIsAdmin(true);
      setShowAdminLogin(false);
    } else {
      alert('Невірний пароль');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isAdmin) {
    return <AdminDashboard onLogout={() => setIsAdmin(false)} />;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 glass border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2" onClick={() => setActiveTab('catalog')}>
              <WheelLogo className="animate-spin-slow cursor-pointer" size={60} />
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
              <button 
                onClick={() => setActiveTab('catalog')}
                className={`hover:text-stone-900 transition-colors ${activeTab === 'catalog' ? 'text-stone-900 font-bold' : ''}`}
              >
                Каталог
              </button>
              <button 
                onClick={() => setActiveTab('reviews')}
                className={`hover:text-stone-900 transition-colors ${activeTab === 'reviews' ? 'text-stone-900 font-bold' : ''}`}
              >
                Відгуки
              </button>
              <button 
                onClick={() => setActiveTab('ads')}
                className={`hover:text-stone-900 transition-colors ${activeTab === 'ads' ? 'text-stone-900 font-bold' : ''}`}
              >
                Оголошення
              </button>
              <a href={INSTAGRAM_LINK} target="_blank" className="hover:text-stone-900 transition-colors">Instagram</a>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-stone-100 rounded-full">
              <div className={`w-2 h-2 rounded-full ${
                supabaseStatus === 'connected' ? 'bg-emerald-500' : 
                supabaseStatus === 'checking' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
              }`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                {supabaseStatus === 'connected' ? 'Supabase Live' : 
                 supabaseStatus === 'checking' ? 'Connecting...' : 
                 supabaseStatus === 'not-configured' ? 'Supabase Offline' : 'Supabase Error'}
              </span>
            </div>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                type="text" 
                placeholder="Пошук..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-stone-100 rounded-full text-sm focus:ring-2 focus:ring-stone-900 outline-none w-48 lg:w-64 transition-all"
              />
            </div>
            <button 
              onClick={() => setShowAdminLogin(true)}
              className="p-2 text-stone-500 hover:text-stone-900 transition-colors"
            >
              <Instagram size={20} />
            </button>
            <button className="md:hidden p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <Menu size={24} />
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-white border-b border-stone-200 overflow-hidden"
            >
              <div className="px-4 py-6 flex flex-col gap-4">
                <button onClick={() => { setActiveTab('catalog'); setIsMenuOpen(false); }} className="text-left font-medium">Каталог</button>
                <button onClick={() => { setActiveTab('reviews'); setIsMenuOpen(false); }} className="text-left font-medium">Відгуки</button>
                <button onClick={() => { setActiveTab('ads'); setIsMenuOpen(false); }} className="text-left font-medium">Оголошення</button>
                <a href={INSTAGRAM_LINK} target="_blank" className="font-medium">Instagram</a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {activeTab === 'catalog' && (
        <>
          {/* Hero Section */}
          <header className="relative py-20 px-4 overflow-hidden bg-stone-900 text-white">
            <div className="absolute inset-0 opacity-20">
              <img 
                src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=1920" 
                className="w-full h-full object-cover"
                alt=""
              />
            </div>
            <div className="max-w-7xl mx-auto relative z-10 text-center">
              <motion.h2 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
              >
                Твій стиль починається <br /> з правильних дисків
              </motion.h2>
              <motion.p 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-stone-400 text-lg max-w-2xl mx-auto mb-10"
              >
                Ексклюзивні диски, які перетворять твоє авто на витвір мистецтва. 
                Найкращий вибір, преміальна якість та індивідуальний підхід до кожного клієнта.
              </motion.p>
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap justify-center gap-4"
              >
                <a 
                  href="#catalog"
                  className="bg-white text-stone-900 px-8 py-4 rounded-full font-bold hover:bg-stone-100 transition-all flex items-center gap-2"
                >
                  Переглянути каталог <ArrowRight size={20} />
                </a>
                <a 
                  href={WHATSAPP_LINK}
                  className="bg-emerald-500 text-white px-8 py-4 rounded-full font-bold hover:bg-emerald-600 transition-all flex items-center gap-2"
                >
                  Зв'язатись у WhatsApp
                </a>
              </motion.div>
            </div>
          </header>

          {/* Catalog */}
          <main id="catalog" className="max-w-7xl mx-auto px-4 py-20">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h3 className="text-3xl font-bold tracking-tight mb-2">Наші товари</h3>
                <p className="text-stone-500">Виберіть найкраще для вашого автомобіля</p>
              </div>
              <div className="text-sm font-medium text-stone-400">
                Знайдено {filteredProducts.length} товарів
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filteredProducts.map((product) => (
                <motion.div 
                  key={product.id}
                  layoutId={`product-${product.id}`}
                  onClick={() => {
                    setSelectedProduct(product);
                    setCurrentImageIndex(0);
                    fetch(`/api/products/${product.id}`); // Log view
                  }}
                  className="group cursor-pointer"
                >
                  <div className="aspect-square rounded-3xl overflow-hidden bg-white mb-4 relative border border-stone-100">
                    <img 
                      src={product.images[0] || 'https://picsum.photos/seed/car/800/1000'} 
                      className="w-full h-full object-contain p-2 transition-transform duration-700 group-hover:scale-110"
                      alt={product.name}
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="bg-white text-stone-900 px-6 py-2 rounded-full font-bold text-sm">
                        Детальніше
                      </span>
                    </div>
                  </div>
                  <h4 className="font-bold text-lg mb-1 group-hover:text-stone-600 transition-colors">{product.name}</h4>
                  <p className="text-stone-900 font-mono font-medium">{product.price} грн</p>
                </motion.div>
              ))}
            </div>
          </main>
        </>
      )}

      {activeTab === 'reviews' && (
        <main className="max-w-4xl mx-auto px-4 py-20">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h2 className="text-4xl font-bold mb-2">Відгуки клієнтів</h2>
              <p className="text-stone-500">Що про нас говорять наші покупці</p>
            </div>
            <button 
              onClick={() => setShowReviewForm(true)}
              className="bg-stone-900 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-stone-800 transition-all"
            >
              <Plus size={20} /> Залишити відгук
            </button>
          </div>

          <div className="space-y-6">
            {reviews.map((review) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={review.id} 
                className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-lg">{review.user_name}</h4>
                    <div className="flex gap-1 text-amber-400 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={16} fill={i < review.rating ? "currentColor" : "none"} />
                      ))}
                    </div>
                  </div>
                  <span className="text-sm text-stone-400">
                    {format(new Date(review.created_at), 'd MMMM yyyy', { locale: uk })}
                  </span>
                </div>
                <p className="text-stone-600 leading-relaxed">{review.comment}</p>
              </motion.div>
            ))}
          </div>
        </main>
      )}

      {activeTab === 'ads' && (
        <main className="max-w-7xl mx-auto px-4 py-20">
          <div className="bg-stone-900 rounded-[3rem] p-12 text-white mb-20 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <img src="https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=1920" className="w-full h-full object-cover" alt="" />
            </div>
            <div className="relative z-10 max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">Продайте свої диски у нас!</h2>
              <p className="text-stone-400 text-lg mb-10">
                В нас ви можете розмістити оголошення і продати свої диски. 
                Для того щоб подати оголошення зв'яжіться з нами!
              </p>
              <button 
                onClick={() => setShowAdModal(true)}
                className="bg-white text-stone-900 px-8 py-4 rounded-full font-bold hover:bg-stone-100 transition-all flex items-center gap-2"
              >
                Подати оголошення <ArrowRight size={20} />
              </button>
            </div>
          </div>

          <div className="mb-12">
            <h3 className="text-3xl font-bold mb-2">Актуальні оголошення</h3>
            <p className="text-stone-500">Можливо, тут є саме те, що ви шукаєте</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {ads.length > 0 ? ads.map((ad) => (
              <motion.div 
                key={ad.id} 
                layoutId={`ad-${ad.id}`}
                onClick={() => {
                  if (!ad.is_placeholder) {
                    setSelectedAd(ad);
                    setCurrentImageIndex(0);
                  }
                }}
                className={`group bg-white rounded-3xl border border-stone-100 overflow-hidden shadow-sm ${!ad.is_placeholder ? 'cursor-pointer' : ''}`}
              >
                <div className="aspect-video relative overflow-hidden">
                  <img 
                    src={Array.isArray(ad.images) && ad.images.length > 0 ? ad.images[0] : 'https://picsum.photos/seed/wheel/800/600'} 
                    className={`w-full h-full object-cover transition-all duration-500 ${ad.is_placeholder ? 'blur-md scale-110 grayscale' : 'group-hover:scale-110'}`}
                    alt="" 
                    referrerPolicy="no-referrer"
                  />
                  {ad.is_placeholder && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="bg-white/20 backdrop-blur-md text-white px-6 py-3 rounded-full text-sm font-bold border border-white/30 text-center max-w-[80%]">
                        Тут може бути ваше оголошення
                      </span>
                    </div>
                  )}
                  {!ad.is_placeholder && (
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="bg-white text-stone-900 px-6 py-2 rounded-full font-bold text-sm">
                        Переглянути
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className={`font-bold text-xl ${ad.is_placeholder ? 'blur-[4px]' : ''}`}>{ad.title}</h4>
                    <p className={`font-mono font-bold text-stone-900 ${ad.is_placeholder ? 'blur-[4px]' : ''}`}>{ad.price} грн</p>
                  </div>
                  <p className={`text-stone-500 text-sm mb-6 line-clamp-2 ${ad.is_placeholder ? 'blur-[4px]' : ''}`}>
                    {ad.description}
                  </p>
                  {!ad.is_placeholder && (
                    <div className="w-full flex items-center justify-center gap-2 bg-stone-100 py-3 rounded-xl font-bold text-stone-600">
                      <Phone size={18} /> {ad.phone}
                    </div>
                  )}
                </div>
              </motion.div>
            )) : (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-stone-200">
                <Megaphone className="mx-auto text-stone-300 mb-4" size={48} />
                <p className="text-stone-500">Наразі оголошень немає. Будьте першим!</p>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Ad Detail Modal */}
      <AnimatePresence>
        {selectedAd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAd(null)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
            />
            <motion.div 
              layoutId={`ad-${selectedAd.id}`}
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row h-auto max-h-[95vh] md:max-h-[85vh]"
            >
              <div className="md:w-1/2 relative bg-stone-50 h-[250px] md:h-auto border-r border-stone-100 flex items-center justify-center">
                <img 
                  src={selectedAd && Array.isArray(selectedAd.images) && selectedAd.images.length > 0 
                    ? selectedAd.images[currentImageIndex] 
                    : 'https://picsum.photos/seed/ad/800/1000'} 
                  className="w-full h-full object-contain p-2 md:p-6"
                  alt=""
                  referrerPolicy="no-referrer"
                />
                {selectedAd && Array.isArray(selectedAd.images) && selectedAd.images.length > 1 && (
                  <>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex((prev) => (prev === 0 ? selectedAd.images.length - 1 : prev - 1));
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full hover:bg-white transition-colors"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex((prev) => (prev === selectedAd.images.length - 1 ? 0 : prev + 1));
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full hover:bg-white transition-colors"
                    >
                      <ChevronRight size={24} />
                    </button>
                  </>
                )}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                  {selectedAd && Array.isArray(selectedAd.images) && selectedAd.images.map((_, idx) => (
                    <div 
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? 'bg-stone-900 w-6' : 'bg-stone-200'}`}
                    />
                  ))}
                </div>
              </div>

              <div className="md:w-1/2 p-6 md:p-10 overflow-y-auto flex flex-col justify-between">
                <div>
                  <button 
                    onClick={() => setSelectedAd(null)}
                    className="absolute top-4 right-4 md:top-6 md:right-6 p-2 text-stone-400 hover:text-stone-900 transition-colors z-10"
                  >
                    <X size={24} />
                  </button>
                  
                  <div className="mb-6">
                    <div className="flex items-center gap-2 text-emerald-600 mb-1">
                      <Megaphone size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Приватне оголошення</span>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold mb-1">{selectedAd.title}</h3>
                    <p className="text-xl md:text-2xl font-mono text-stone-900">{selectedAd.price} грн</p>
                  </div>
  
                  <div className="prose prose-stone prose-sm mb-6 max-h-[150px] md:max-h-none overflow-y-auto md:overflow-visible">
                    <p className="text-stone-600 leading-relaxed">
                      {selectedAd.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-stone-100">
                  <h4 className="font-bold text-[10px] uppercase tracking-widest text-stone-400">Зв'язатись з власником</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <a 
                      href={`tel:${selectedAd.phone}`}
                      className="flex items-center justify-center gap-3 bg-stone-900 text-white py-3 md:py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all text-sm md:text-base"
                    >
                      <Phone size={18} /> {selectedAd.phone}
                    </a>
                  </div>
                  <p className="text-[10px] text-stone-400 text-center">
                    Будь ласка, повідомте власнику, що ви знайшли це оголошення на AUTO TUTANU
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ad Info Modal */}
      <AnimatePresence>
        {showAdModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdModal(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl w-full max-w-lg text-center"
            >
              <button 
                onClick={() => setShowAdModal(false)}
                className="absolute top-6 right-6 p-2 text-stone-400 hover:text-stone-900 transition-colors"
              >
                <X size={24} />
              </button>
              
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8">
                <Megaphone size={40} />
              </div>
              
              <h3 className="text-3xl font-bold mb-4">Розмістити оголошення</h3>
              <p className="text-stone-600 text-lg mb-4">
                Щоб розмістити оголошення вам потрібно його оплатити!
              </p>
              <div className="bg-stone-100 py-4 px-6 rounded-2xl mb-8">
                <p className="text-stone-900 font-bold text-2xl">Ціна: 200 грн</p>
              </div>
              
              <div className="space-y-4">
                <a 
                  href={WHATSAPP_LINK}
                  target="_blank"
                  className="w-full flex items-center justify-center gap-3 bg-emerald-500 text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all"
                >
                  <MessageCircle size={24} /> Зв'язатись у WhatsApp
                </a>
                <a 
                  href={`tel:${PHONE_NUMBER}`}
                  className="w-full flex items-center justify-center gap-3 bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all"
                >
                  <Phone size={24} /> Зателефонувати нам
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review Form Modal */}
      <AnimatePresence>
        {showReviewForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReviewForm(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md"
            >
              <h3 className="text-2xl font-bold mb-6">Залишити відгук</h3>
              <form onSubmit={handleAddReview} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Ваше ім'я</label>
                  <input 
                    required
                    type="text" 
                    value={newReview.user_name}
                    onChange={(e) => setNewReview({...newReview, user_name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none"
                    placeholder="Як вас звати?"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Оцінка</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button 
                        key={star}
                        type="button"
                        onClick={() => setNewReview({...newReview, rating: star})}
                        className={`p-1 transition-colors ${star <= newReview.rating ? 'text-amber-400' : 'text-stone-200'}`}
                      >
                        <Star size={32} fill="currentColor" />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Ваш коментар</label>
                  <textarea 
                    required
                    rows={4}
                    value={newReview.comment}
                    onChange={(e) => setNewReview({...newReview, comment: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none resize-none"
                    placeholder="Поділіться вашими враженнями..."
                  />
                </div>
                <button 
                  disabled={isSubmittingReview}
                  className={`w-full bg-stone-900 text-white py-4 rounded-xl font-bold hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 ${isSubmittingReview ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isSubmittingReview ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Публікація...
                    </>
                  ) : (
                    'Опублікувати відгук'
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
            />
            <motion.div 
              layoutId={`product-${selectedProduct.id}`}
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
            >
              <div className="md:w-1/2 relative bg-white h-[400px] md:h-auto border-r border-stone-100">
                <img 
                  src={selectedProduct.images[currentImageIndex] || 'https://picsum.photos/seed/car/800/1000'} 
                  className="w-full h-full object-contain p-4"
                  alt=""
                />
                {selectedProduct.images.length > 1 && (
                  <>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex((prev) => (prev === 0 ? selectedProduct.images.length - 1 : prev - 1));
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full hover:bg-white transition-colors"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex((prev) => (prev === selectedProduct.images.length - 1 ? 0 : prev + 1));
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full hover:bg-white transition-colors"
                    >
                      <ChevronRight size={24} />
                    </button>
                  </>
                )}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                  {selectedProduct.images.map((_, idx) => (
                    <div 
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white w-6' : 'bg-white/40'}`}
                    />
                  ))}
                </div>
              </div>

              <div className="md:w-1/2 p-8 md:p-12 overflow-y-auto">
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-6 right-6 p-2 text-stone-400 hover:text-stone-900 transition-colors"
                >
                  <X size={24} />
                </button>
                
                <div className="mb-8">
                  <h3 className="text-3xl font-bold mb-2">{selectedProduct.name}</h3>
                  <p className="text-2xl font-mono text-stone-900">{selectedProduct.price} грн</p>
                </div>

                <div className="prose prose-stone mb-10">
                  <p className="text-stone-600 leading-relaxed">
                    {selectedProduct.description}
                  </p>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-sm uppercase tracking-widest text-stone-400">Зв'язатись з нами</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <a 
                      href={WHATSAPP_LINK}
                      target="_blank"
                      className="flex items-center justify-center gap-3 bg-emerald-500 text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all"
                    >
                      <MessageCircle size={20} /> WhatsApp
                    </a>
                    <a 
                      href={`tel:${PHONE_NUMBER}`}
                      className="flex items-center justify-center gap-3 bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all"
                    >
                      <Phone size={20} /> Зателефонувати
                    </a>
                  </div>
                  <a 
                    href={INSTAGRAM_LINK}
                    target="_blank"
                    className="flex items-center justify-center gap-3 border border-stone-200 py-4 rounded-2xl font-bold hover:bg-stone-50 transition-all"
                  >
                    <Instagram size={20} /> Наш Instagram
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showAdminLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdminLogin(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md"
            >
              <h3 className="text-2xl font-bold mb-6 text-center">Вхід для адміна</h3>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Пароль</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none"
                    placeholder="Введіть пароль..."
                  />
                </div>
                <button className="w-full bg-stone-900 text-white py-3 rounded-xl font-bold hover:bg-stone-800 transition-colors">
                  Увійти
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 py-12 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            <WheelLogo className="animate-spin-slow cursor-pointer" size={80} />
            <div>
              <p className="text-stone-500 text-sm">© 2024 Всі права захищені.</p>
            </div>
          </div>
          <div className="flex gap-6">
            <a href={INSTAGRAM_LINK} target="_blank" className="text-stone-400 hover:text-stone-900 transition-colors">
              <Instagram size={24} />
            </a>
            <a href={WHATSAPP_LINK} target="_blank" className="text-stone-400 hover:text-stone-900 transition-colors">
              <MessageCircle size={24} />
            </a>
            <a href={`tel:${PHONE_NUMBER}`} className="text-stone-400 hover:text-stone-900 transition-colors">
              <Phone size={24} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
