import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  TrendingUp, 
  Plus, 
  Trash2, 
  Edit, 
  Eye, 
  Users,
  LogOut,
  Image as ImageIcon,
  X,
  Megaphone,
  Star,
  MessageSquare
} from 'lucide-react';
import { Product, Stats, Ad, Review } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../services/supabase';
import { GoogleGenAI } from "@google/genai";

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingAd, setIsAddingAd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeView, setActiveView] = useState<'products' | 'ads' | 'reviews'>('products');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    images: [] as string[],
    sku: ''
  });
  const [adFormData, setAdFormData] = useState({
    title: '',
    description: '',
    price: '',
    phone: '',
    images: [] as string[],
    is_placeholder: false
  });

  useEffect(() => {
    fetchProducts();
    fetchAds();
    fetchReviews();
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchReviews = async () => {
    let allReviews: any[] = [];
    let supabaseSuccess = false;

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        if (data) {
          allReviews = [...data];
          supabaseSuccess = true;
        }
      }
    } catch (error) {
      console.error('Error fetching reviews from Supabase:', error);
    }

    try {
      const res = await fetch('/api/reviews');
      if (res.ok) {
        const localData = await res.json();
        if (Array.isArray(localData)) {
          // Merge and remove duplicates by some criteria or just append if they are different
          // Since IDs might overlap, we can't easily merge by ID.
          // Let's just use local if Supabase failed or is empty
          if (!supabaseSuccess || allReviews.length === 0) {
            allReviews = localData;
          } else {
            // If both have data, we might want to show both, but it's tricky with IDs.
            // For now, let's just prioritize Supabase if it has data.
          }
        }
      }
    } catch (localError) {
      console.error('Local API also failed for reviews:', localError);
    }

    setReviews(allReviews);
  };

  const fetchProducts = async () => {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
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

  const fetchAds = async () => {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAds(data || []);
    } catch (error) {
      console.error('Error fetching ads from Supabase (using fallback):', error);
      try {
        const res = await fetch('/api/ads');
        const data = await res.json();
        setAds(data || []);
      } catch (localError) {
        console.error('Local API also failed:', localError);
        setAds([]);
      }
    }
  };

  const fetchStats = async () => {
    const res = await fetch('/api/stats');
    const data = await res.json();
    setStats(data);
  };

  const [isGenerating, setIsGenerating] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const price = parseFloat(formData.price);
      if (isNaN(price)) throw new Error('Ціна має бути числом');

      let success = false;
      const productData = {
        ...formData,
        price,
        sku: formData.sku || `AT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
      };

      try {
        if (!supabase) throw new Error('Supabase not configured');
        
        if (editingProduct) {
          const { error } = await supabase
            .from('products')
            .update(productData)
            .eq('id', editingProduct.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('products')
            .insert([productData]);
          if (error) throw error;
        }
        success = true;
      } catch (error) {
        console.error('Error submitting product to Supabase (using fallback):', error);
        const method = editingProduct ? 'PUT' : 'POST';
        const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData)
        });
        if (res.ok) success = true;
      }

      if (success) {
        alert(editingProduct ? 'Товар оновлено!' : 'Товар опубліковано!');
        setIsAdding(false);
        setEditingProduct(null);
        setFormData({ name: '', description: '', price: '', images: [], sku: '' });
        fetchProducts();
      } else {
        throw new Error('Не вдалося зберегти товар');
      }
    } catch (error: any) {
      console.error('Error submitting product:', error);
      alert('Помилка: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const price = parseFloat(adFormData.price);
      if (isNaN(price)) throw new Error('Ціна має бути числом');

      let success = false;
      try {
        if (!supabase) throw new Error('Supabase not configured');
        const { error } = await supabase
          .from('ads')
          .insert([{
            ...adFormData,
            price,
          }]);
        
        if (error) throw error;
        success = true;
      } catch (error) {
        console.error('Error adding ad to Supabase (using fallback):', error);
        // Fallback to local API
        const res = await fetch('/api/ads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...adFormData,
            price,
          })
        });
        if (!res.ok) throw new Error('Локальна помилка при збереженні оголошення');
        success = true;
      }

      if (success) {
        alert('Оголошення опубліковано!');
        setIsAddingAd(false);
        setAdFormData({ title: '', description: '', price: '', phone: '', images: [], is_placeholder: false });
        fetchAds();
      }
    } catch (error: any) {
      console.error('Error submitting ad:', error);
      alert('Помилка: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Ви впевнені?')) {
      try {
        let success = false;
        try {
          if (!supabase) throw new Error('Supabase not configured');
          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);
          if (error) throw error;
          success = true;
        } catch (error) {
          console.error('Error deleting product from Supabase (using fallback):', error);
          const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
          if (res.ok) success = true;
        }
        if (success) fetchProducts();
      } catch (error) {
        console.error('Error in handleDelete:', error);
      }
    }
  };

  const handleDeleteAd = async (id: number) => {
    if (confirm('Ви впевнені?')) {
      try {
        let success = false;
        try {
          if (!supabase) throw new Error('Supabase not configured');
          const { error } = await supabase
            .from('ads')
            .delete()
            .eq('id', id);
          if (error) throw error;
          success = true;
        } catch (error) {
          console.error('Error deleting ad from Supabase (using fallback):', error);
          const res = await fetch(`/api/ads/${id}`, { method: 'DELETE' });
          if (res.ok) success = true;
        }
        if (success) fetchAds();
      } catch (error) {
        console.error('Error in handleDeleteAd:', error);
      }
    }
  };

  const handleDeleteReview = async (id: number) => {
    if (confirm('Ви впевнені, що хочете видалити цей відгук?')) {
      try {
        let success = false;
        try {
          if (!supabase) throw new Error('Supabase not configured');
          const { error } = await supabase
            .from('reviews')
            .delete()
            .eq('id', id);
          if (error) throw error;
          success = true;
        } catch (error) {
          console.error('Error deleting review from Supabase (using fallback):', error);
          const res = await fetch(`/api/reviews/${id}`, { method: 'DELETE' });
          if (res.ok) success = true;
        }
        if (success) fetchReviews();
      } catch (error) {
        console.error('Error in handleDeleteReview:', error);
      }
    }
  };

  const handleSeedReviews = async () => {
    if (!confirm('Ви впевнені, що хочете згенерувати 50 випадкових відгуків? Це може зайняти деякий час.')) return;
    
    setIsSubmitting(true);
    console.log('Starting to seed reviews...');
    try {
      const names = [
        "Олександр", "Марія", "Іван", "Олена", "Дмитро", "Тетяна", "Андрій", "Оксана", "Сергій", "Наталія",
        "Віталій", "Юлія", "Максим", "Світлана", "Артем", "Ірина", "Денис", "Ольга", "Микола", "Анна",
        "Василь", "Вікторія", "Павло", "Людмила", "Євген", "Галина", "Роман", "Надія", "Тарас", "Валентина"
      ];
      const comments = [
        "Чудові диски, якість на висоті! Вже рік катаюсь, все супер.",
        "Швидка доставка, рекомендую цей магазин всім знайомим.",
        "Дуже задоволений покупкою, виглядають круто на моєму авто.",
        "Найкращий сервіс в Україні. Допомогли підібрати правильний виліт.",
        "Все підійшло ідеально, дякую за професійну консультацію!",
        "Великий вибір та приємні ціни. Буду звертатися ще.",
        "Професійна консультація, допомогли з вибором дисків для BMW.",
        "Диски прийшли добре запаковані, без жодних подряпин.",
        "Якісний товар за помірну ціну. Однозначно 5 зірок.",
        "Буду замовляти ще! Дуже задоволений відношенням до клієнта.",
        "Диски просто вогонь! Машина стала виглядати зовсім інакше.",
        "Дякую за оперативність. Замовив вчора, сьогодні вже на пошті.",
        "Якість фарбування вражає. Навіть після зими як нові.",
        "Приємно мати справу з професіоналами. Рекомендую!",
        "Найкращі ціни на оригінальні диски. Перевірено часом.",
        "Дуже ввічливий персонал. Все розказали і показали.",
        "Шукав саме такі диски дуже довго. Дякую, що знайшли їх для мене!",
        "Доставка в Одесу зайняла всього один день. Супер!",
        "Параметри підійшли ідеально, ніде не затирає.",
        "Задоволений на всі 100%. Кращого варіанту не знайти."
      ];

      const newReviews = [];
      const startDate = new Date('2021-01-01T00:00:00Z').getTime();
      const endDate = new Date().getTime();

      for (let i = 0; i < 50; i++) {
        const randomTimestamp = startDate + Math.random() * (endDate - startDate);
        newReviews.push({
          user_name: names[Math.floor(Math.random() * names.length)],
          rating: 4 + Math.floor(Math.random() * 2),
          comment: comments[Math.floor(Math.random() * comments.length)],
          created_at: new Date(randomTimestamp).toISOString()
        });
      }

      let success = false;
      if (supabase) {
        try {
          const { error } = await supabase.from('reviews').insert(newReviews);
          if (error) throw error;
          success = true;
          console.log('Successfully seeded reviews to Supabase');
        } catch (supabaseError) {
          console.error('Supabase seeding failed, falling back to local API:', supabaseError);
        }
      }

      if (!success) {
        const res = await fetch('/api/reviews/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newReviews)
        });
        if (!res.ok) throw new Error('Помилка при збереженні в локальну базу');
        success = true;
        console.log('Successfully seeded reviews to local API');
      }
      
      alert('50 відгуків успішно згенеровано!');
      fetchReviews();
    } catch (error: any) {
      console.error('Error seeding reviews:', error);
      alert('Помилка при генерації: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [imageUrlInput, setImageUrlInput] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const adFileInputRef = React.useRef<HTMLInputElement>(null);

  const addImageUrl = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (imageUrlInput && formData.images.length < 10) {
      setFormData({ ...formData, images: [...formData.images, imageUrlInput] });
      setImageUrlInput('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'ad') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (type === 'product' && formData.images.length < 10) {
          setFormData({ ...formData, images: [...formData.images, base64String] });
        } else if (type === 'ad' && adFormData.images.length < 10) {
          setAdFormData({ ...adFormData, images: [...adFormData.images, base64String] });
        }
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Панель адміністратора</h1>
            <p className="text-stone-500">Керуйте вашим магазином та переглядайте статистику</p>
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={20} /> Вийти
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="admin-card flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-stone-500">Зараз на сайті</p>
              <p className="text-2xl font-bold">{stats?.onlineUsers || 0}</p>
            </div>
          </div>
          <div className="admin-card flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm text-stone-500">Всього візитів</p>
              <p className="text-2xl font-bold">{stats?.totalVisits || 0}</p>
            </div>
          </div>
          <div className="admin-card flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Eye size={24} />
            </div>
            <div>
              <p className="text-sm text-stone-500">Переглядів товарів</p>
              <p className="text-2xl font-bold">{stats?.totalViews || 0}</p>
            </div>
          </div>
          <div className="admin-card flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <Package size={24} />
            </div>
            <div>
              <p className="text-sm text-stone-500">Всього товарів</p>
              <p className="text-2xl font-bold">{products.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mb-8">
        <div className="flex gap-4 border-b border-stone-200">
          <button 
            onClick={() => setActiveView('products')}
            className={`pb-4 px-2 font-medium transition-all relative ${activeView === 'products' ? 'text-stone-900' : 'text-stone-400'}`}
          >
            <div className="flex items-center gap-2">
              <Package size={20} /> Товари
            </div>
            {activeView === 'products' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-900" />}
          </button>
          <button 
            onClick={() => setActiveView('ads')}
            className={`pb-4 px-2 font-medium transition-all relative ${activeView === 'ads' ? 'text-stone-900' : 'text-stone-400'}`}
          >
            <div className="flex items-center gap-2">
              <Megaphone size={20} /> Оголошення
            </div>
            {activeView === 'ads' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-900" />}
          </button>
          <button 
            onClick={() => setActiveView('reviews')}
            className={`pb-4 px-2 font-medium transition-all relative ${activeView === 'reviews' ? 'text-stone-900' : 'text-stone-400'}`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare size={20} /> Відгуки
            </div>
            {activeView === 'reviews' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-900" />}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {activeView === 'products' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Product List */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Товари</h2>
                <button 
                  onClick={() => {
                    setIsAdding(true);
                    setEditingProduct(null);
                    setFormData({ name: '', description: '', price: '', images: [], sku: '' });
                  }}
                  className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-xl hover:bg-stone-800 transition-colors"
                >
                  <Plus size={20} /> Додати товар
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-stone-50 border-bottom border-stone-200">
                    <tr>
                      <th className="px-6 py-4 text-sm font-medium text-stone-500">Код</th>
                      <th className="px-6 py-4 text-sm font-medium text-stone-500">Товар</th>
                      <th className="px-6 py-4 text-sm font-medium text-stone-500">Ціна</th>
                      <th className="px-6 py-4 text-sm font-medium text-stone-500">Перегляди</th>
                      <th className="px-6 py-4 text-sm font-medium text-stone-500 text-right">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {products.map((product) => (
                      <tr key={product.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs bg-stone-100 px-2 py-1 rounded text-stone-600">{product.sku}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={product.images[0] || 'https://picsum.photos/seed/car/200/200'} 
                              className="w-10 h-10 rounded-lg object-cover"
                              alt=""
                            />
                            <span className="font-medium">{product.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">{product.price} грн</td>
                        <td className="px-6 py-4">{product.views}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => {
                                setEditingProduct(product);
                                setFormData({
                                  name: product.name,
                                  description: product.description,
                                  price: product.price.toString(),
                                  images: product.images,
                                  sku: product.sku
                                });
                                setIsAdding(true);
                              }}
                              className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
                            >
                              <Edit size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete(product.id)}
                              className="p-2 text-stone-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Side Stats */}
            <div className="space-y-6">
              <div className="admin-card">
                <h3 className="text-lg font-semibold mb-4">Найпопулярніші товари</h3>
                <div className="space-y-4">
                  {stats?.mostViewed.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-stone-400 font-mono text-sm">0{idx + 1}</span>
                        <span className="font-medium text-sm truncate max-w-[150px]">{item.name}</span>
                      </div>
                      <span className="text-sm text-stone-500">{item.views} переглядів</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'ads' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Оголошення</h2>
              <button 
                onClick={() => setIsAddingAd(true)}
                className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-xl hover:bg-stone-800 transition-colors"
              >
                <Plus size={20} /> Додати оголошення
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-stone-50 border-bottom border-stone-200">
                  <tr>
                    <th className="px-6 py-4 text-sm font-medium text-stone-500">Заголовок</th>
                    <th className="px-6 py-4 text-sm font-medium text-stone-500">Ціна</th>
                    <th className="px-6 py-4 text-sm font-medium text-stone-500">Телефон</th>
                    <th className="px-6 py-4 text-sm font-medium text-stone-500">Тип</th>
                    <th className="px-6 py-4 text-sm font-medium text-stone-500 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {ads.length > 0 ? ads.map((ad) => (
                    <tr key={ad.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={Array.isArray(ad.images) && ad.images.length > 0 ? ad.images[0] : 'https://picsum.photos/seed/ad/200/200'} 
                            className="w-10 h-10 rounded-lg object-cover"
                            alt=""
                          />
                          <span className="font-medium">{ad.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">{ad.price} грн</td>
                      <td className="px-6 py-4">{ad.phone}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${ad.is_placeholder ? 'bg-stone-100 text-stone-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {ad.is_placeholder ? 'Заглушка' : 'Активне'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDeleteAd(ad.id)}
                          className="p-2 text-stone-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-stone-400">
                        <Megaphone className="mx-auto mb-2 opacity-20" size={32} />
                        <p>Оголошень поки немає</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeView === 'reviews' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Відгуки клієнтів</h2>
              <button 
                onClick={handleSeedReviews}
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                <TrendingUp size={20} className={isSubmitting ? 'animate-spin' : ''} /> 
                {isSubmitting ? 'Генерую...' : 'Згенерувати 50 відгуків'}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-stone-50 border-bottom border-stone-200">
                  <tr>
                    <th className="px-6 py-4 text-sm font-medium text-stone-500">Клієнт</th>
                    <th className="px-6 py-4 text-sm font-medium text-stone-500">Рейтинг</th>
                    <th className="px-6 py-4 text-sm font-medium text-stone-500">Коментар</th>
                    <th className="px-6 py-4 text-sm font-medium text-stone-500">Дата</th>
                    <th className="px-6 py-4 text-sm font-medium text-stone-500 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {reviews.length > 0 ? reviews.map((review) => (
                    <tr key={review.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-medium">{review.user_name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-0.5 text-amber-400">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} />
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-stone-600 line-clamp-2 max-w-md">{review.comment}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-500">
                        {new Date(review.created_at).toLocaleDateString('uk-UA')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDeleteReview(review.id)}
                          className="p-2 text-stone-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-stone-400">
                        <MessageSquare className="mx-auto mb-2 opacity-20" size={32} />
                        <p>Відгуків поки немає</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal for Add Ad */}
      <AnimatePresence>
        {isAddingAd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingAd(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh]"
            >
              <div className="p-4 sm:p-6 border-b border-stone-100 flex justify-between items-center">
                <h3 className="text-lg sm:text-xl font-bold">Додати оголошення</h3>
                <button onClick={() => setIsAddingAd(false)} className="text-stone-400 hover:text-stone-900 p-1">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleAdSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Заголовок</label>
                    <input 
                      required
                      type="text"
                      value={adFormData.title}
                      onChange={e => setAdFormData({ ...adFormData, title: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Ціна (грн)</label>
                    <input 
                      required
                      type="number"
                      value={adFormData.price}
                      onChange={e => setAdFormData({ ...adFormData, price: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Телефон власника</label>
                    <input 
                      required
                      type="text"
                      value={adFormData.phone}
                      onChange={e => setAdFormData({ ...adFormData, phone: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-8">
                    <input 
                      type="checkbox"
                      id="is_placeholder"
                      checked={adFormData.is_placeholder}
                      onChange={e => setAdFormData({ ...adFormData, is_placeholder: e.target.checked })}
                      className="w-5 h-5 rounded border-stone-200 text-stone-900 focus:ring-stone-900"
                    />
                    <label htmlFor="is_placeholder" className="text-sm font-medium text-stone-700">Це заглушка (замальоване)</label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">Опис</label>
                  <textarea 
                    required
                    rows={4}
                    value={adFormData.description}
                    onChange={e => setAdFormData({ ...adFormData, description: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none resize-none"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-medium text-stone-700">Зображення ({adFormData.images.length}/10)</label>
                  <input 
                    type="file" 
                    ref={adFileInputRef}
                    onChange={(e) => handleFileUpload(e, 'ad')}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {adFormData.images.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200">
                        <img src={url} className="w-full h-full object-cover" alt="" />
                        <button 
                          type="button"
                          onClick={() => setAdFormData({ ...adFormData, images: adFormData.images.filter((_, i) => i !== idx) })}
                          className="absolute top-1 right-1 p-1 bg-white/80 rounded-full text-red-600 hover:bg-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {adFormData.images.length < 10 && (
                      <button 
                        type="button"
                        onClick={() => adFileInputRef.current?.click()}
                        className="aspect-square rounded-lg border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400 hover:border-stone-400 hover:text-stone-600 transition-all"
                      >
                        <Plus size={20} />
                        <span className="text-[10px] mt-1 text-center px-1">Завантажити</span>
                      </button>
                    )}
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full bg-stone-900 text-white py-3 rounded-xl font-bold hover:bg-stone-800 transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? 'Публікація...' : 'Опублікувати оголошення'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh]"
            >
              <div className="p-4 sm:p-6 border-b border-stone-100 flex justify-between items-center">
                <h3 className="text-lg sm:text-xl font-bold">{editingProduct ? 'Редагувати товар' : 'Додати новий товар'}</h3>
                <button onClick={() => setIsAdding(false)} className="text-stone-400 hover:text-stone-900 p-1">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Назва товару</label>
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none"
                      placeholder="Наприклад: Автомобільні килимки"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Ціна (грн)</label>
                    <input 
                      required
                      type="number"
                      value={formData.price}
                      onChange={e => setFormData({ ...formData, price: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">Код товару (SKU)</label>
                  <input 
                    type="text"
                    value={formData.sku}
                    onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none font-mono"
                    placeholder="Автоматично (напр. AT-X123)"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-stone-700">Опис</label>
                    <button 
                      type="button"
                      disabled={isGenerating}
                      onClick={async () => {
                        if (!formData.name) return alert('Спочатку введіть назву товару');
                        setIsGenerating(true);
                        try {
                          const apiKey = process.env.GEMINI_API_KEY;
                          if (!apiKey) {
                            throw new Error('API ключ не знайдено. Будь ласка, перевірте налаштування Secrets.');
                          }

                          const ai = new GoogleGenAI({ apiKey });
                          const response = await ai.models.generateContent({
                            model: "gemini-3-flash-preview",
                            contents: `Напиши короткий, привабливий опис для товару "${formData.name}" для магазину автомобільних дисків. Використовуй українську мову. Опис має бути професійним та технічно грамотним.`,
                          });

                          if (!response.text) {
                            throw new Error('ШІ повернув порожню відповідь.');
                          }

                          setFormData({ ...formData, description: response.text });
                        } catch (err: any) {
                          console.error('AI Generation Error:', err);
                          alert('Не вдалося згенерувати опис: ' + err.message);
                        } finally {
                          setIsGenerating(false);
                        }
                      }}
                      className={`text-xs font-medium hover:underline flex items-center gap-1 ${isGenerating ? 'text-stone-400 cursor-not-allowed' : 'text-purple-600'}`}
                    >
                      <TrendingUp size={12} className={isGenerating ? 'animate-pulse' : ''} /> 
                      {isGenerating ? 'Генерую...' : 'Згенерувати ШІ'}
                    </button>
                  </div>
                  <textarea 
                    required
                    rows={4}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none resize-none"
                    placeholder="Детальний опис товару..."
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-stone-700">Зображення ({formData.images.length}/10)</label>
                  </div>
                  
                  {/* Hidden file input */}
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={(e) => handleFileUpload(e, 'product')}
                    accept="image/*"
                    className="hidden"
                  />

                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={imageUrlInput}
                      onChange={e => setImageUrlInput(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none"
                      placeholder="Вставте URL зображення..."
                    />
                    <button 
                      type="button"
                      onClick={() => addImageUrl()}
                      className="bg-stone-900 text-white px-4 py-2 rounded-xl hover:bg-stone-800 transition-colors"
                    >
                      Додати
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {formData.images.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200">
                        <img src={url} className="w-full h-full object-cover" alt="" />
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, images: formData.images.filter((_, i) => i !== idx) })}
                          className="absolute top-1 right-1 p-1 bg-white/80 rounded-full text-red-600 hover:bg-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {formData.images.length < 10 && (
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-lg border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400 hover:border-stone-400 hover:text-stone-600 transition-all"
                      >
                        <Plus size={20} />
                        <span className="text-[10px] mt-1 text-center px-1">Завантажити файл</span>
                      </button>
                    )}
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full bg-stone-900 text-white py-3 rounded-xl font-bold hover:bg-stone-800 transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? 'Публікація...' : (editingProduct ? 'Зберегти зміни' : 'Опублікувати товар')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
