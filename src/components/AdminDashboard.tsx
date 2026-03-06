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
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
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
  const [activeView, setActiveView] = useState<'products' | 'ads' | 'reviews' | 'stats'>('products');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    images: [] as string[],
    sku: '',
    is_sale: false,
    old_price: ''
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

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmModal({ message, onConfirm });
  };

  const fetchReviews = async () => {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    }
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
      console.error('Error fetching products:', error);
      setProducts([]);
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
      console.error('Error fetching ads:', error);
      setAds([]);
    }
  };

  const fetchStats = async () => {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      let visitsCount = 0;
      let productsData: any[] = [];
      let totalViews = 0;
      let mostViewed: any[] = [];

      // Fetch products for views and most viewed
      try {
        const { data, error: productsError } = await supabase
          .from('products')
          .select('id, name, views')
          .order('views', { ascending: false });
        
        if (productsError) throw productsError;
        productsData = data || [];
        totalViews = productsData.reduce((acc, p) => acc + (p.views || 0), 0);
        mostViewed = productsData.slice(0, 5);
      } catch (err: any) {
        console.warn('Could not fetch products for stats:', err.message);
      }
      
      // Fetch total visits from stats table
      try {
        const { count, error: visitsError } = await supabase
          .from('stats')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'visit');
        
        if (visitsError) throw visitsError;
        visitsCount = count || 0;
      } catch (err: any) {
        console.warn('Could not fetch visits from Supabase stats table:', err.message);
      }

      // For online users, we still use the server socket
      let onlineUsers = 0;
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const serverData = await res.json();
          onlineUsers = serverData.onlineUsers;
        }
      } catch (err) {
        console.warn('Could not fetch online users from server:', err);
      }
      
      setStats({
        totalVisits: visitsCount,
        totalViews: totalViews,
        mostViewed: mostViewed,
        onlineUsers: onlineUsers
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Fallback to server stats if Supabase fails
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          setStats({
            totalVisits: data.totalVisits || 0,
            totalViews: data.totalViews || 0,
            mostViewed: data.mostViewed || [],
            onlineUsers: data.onlineUsers || 0
          });
        }
      } catch (e) {
        console.error('Full stats failure:', e);
      }
    }
  };

  const [isGenerating, setIsGenerating] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (!formData.name.trim()) throw new Error('Назва товару обов\'язкова');
      const price = parseFloat(formData.price.replace(',', '.'));
      if (isNaN(price)) throw new Error('Ціна має бути числом');

      let success = false;
      // Generate 3-digit numeric SKU if not provided
      let sku = formData.sku;
      if (!sku) {
        const numericSkus = products
          .map(p => parseInt(p.sku))
          .filter(n => !isNaN(n));
        const nextSku = numericSkus.length > 0 ? Math.max(...numericSkus) + 1 : 1;
        sku = nextSku.toString().padStart(3, '0');
      }

      const productData: any = {
        name: formData.name.trim(),
        description: formData.description,
        price,
        images: formData.images,
        sku
      };

      // Only include sale fields if they are actually used to avoid errors if columns don't exist yet
      if (formData.is_sale) {
        productData.is_sale = true;
        if (formData.old_price) {
          productData.old_price = parseFloat(formData.old_price.replace(',', '.'));
        }
      }

      console.log('Submitting product data:', productData);

      try {
        if (!supabase) throw new Error('Supabase not configured');
        
        let result;
        if (editingProduct) {
          result = await supabase
            .from('products')
            .update(productData)
            .eq('id', editingProduct.id);
        } else {
          result = await supabase
            .from('products')
            .insert([productData]);
        }
        
        if (result.error) {
          // Check if the error is due to missing columns
          if (result.error.message?.includes('column "is_sale" does not exist') || 
              result.error.message?.includes('column "old_price" does not exist')) {
            throw new Error('У вашій базі даних Supabase відсутні колонки "is_sale" або "old_price". Будь ласка, додайте їх до таблиці "products" (is_sale: boolean, old_price: numeric) або зверніться до розробника.');
          }
          throw result.error;
        }
        
        showNotification(editingProduct ? 'Товар оновлено!' : 'Товар опубліковано!');
        setIsAdding(false);
        setEditingProduct(null);
        setFormData({ name: '', description: '', price: '', images: [], sku: '', is_sale: false, old_price: '' });
        fetchProducts();
      } catch (error: any) {
        console.error('Error submitting product:', error);
        showNotification('Помилка: ' + error.message, 'error');
      } finally {
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      showNotification('Помилка: ' + error.message, 'error');
      setIsSubmitting(false);
    }
  };

  const handleAdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const price = parseFloat(adFormData.price.replace(',', '.'));
      if (isNaN(price)) throw new Error('Ціна має бути числом');

      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase
        .from('ads')
        .insert([{
          ...adFormData,
          price,
        }]);
      
      if (error) {
        if (error.message?.includes('column "is_placeholder" does not exist')) {
          throw new Error('У вашій таблиці "ads" відсутня колонка "is_placeholder". Будь ласка, додайте її (boolean, default false) або зверніться до розробника.');
        }
        throw error;
      }
      
      showNotification('Оголошення опубліковано!');
      setIsAddingAd(false);
      setAdFormData({ title: '', description: '', price: '', phone: '', images: [], is_placeholder: false });
      fetchAds();
    } catch (error: any) {
      console.error('Error submitting ad:', error);
      showNotification('Помилка: ' + error.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    showConfirm('Ви впевнені?', async () => {
      try {
        if (!supabase) throw new Error('Supabase not configured');
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id);
        if (error) throw error;
        fetchProducts();
        showNotification('Товар видалено');
      } catch (error: any) {
        console.error('Error deleting product:', error);
        showNotification('Помилка при видаленні: ' + error.message, 'error');
      }
    });
  };

  const handleDeleteAd = async (id: number | string) => {
    showConfirm('Ви впевнені?', async () => {
      try {
        if (!supabase) throw new Error('Supabase not configured');
        
        const { data, error } = await supabase
          .from('ads')
          .delete()
          .eq('id', id)
          .select();
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
          showNotification('Помилка: Оголошення не видалено. Перевірте налаштування прав доступу (RLS) у Supabase для таблиці "ads".', 'error');
        } else {
          fetchAds();
          showNotification('Оголошення видалено');
        }
      } catch (error: any) {
        console.error('Error deleting ad:', error);
        showNotification('Помилка при видаленні: ' + (error.message || 'Невідома помилка'), 'error');
      }
    });
  };

  const handleDeleteReview = async (id: number) => {
    showConfirm('Ви впевнені, що хочете видалити цей відгук?', async () => {
      try {
        if (!supabase) throw new Error('Supabase not configured');
        const { error } = await supabase
          .from('reviews')
          .delete()
          .eq('id', id);
        if (error) throw error;
        fetchReviews();
        showNotification('Відгук видалено');
      } catch (error: any) {
        console.error('Error deleting review:', error);
        showNotification('Помилка при видаленні: ' + error.message, 'error');
      }
    });
  };

  const handleSeedReviews = async () => {
    showConfirm('Ви впевнені, що хочете згенерувати 50 випадкових відгуків? Це може зайняти деякий час.', async () => {
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

        if (supabase) {
          const { error } = await supabase.from('reviews').insert(newReviews);
          if (error) throw error;
          console.log('Successfully seeded reviews to Supabase');
        } else {
          throw new Error('Supabase not configured');
        }
        
        showNotification('50 відгуків успішно згенеровано!');
        fetchReviews();
      } catch (error: any) {
        console.error('Error seeding reviews:', error);
        showNotification('Помилка при генерації: ' + error.message, 'error');
      } finally {
        setIsSubmitting(false);
      }
    });
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

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState(0);

  const optimizeDatabase = async () => {
    showConfirm('Це стисне всі існуючі зображення в базі даних для пришвидшення завантаження. Це може зайняти деякий час. Продовжити?', async () => {
      setIsOptimizing(true);
      setOptimizationProgress(0);
      try {
        if (!supabase) throw new Error('Supabase not configured');

        // Optimize Products
        const { data: productsData, error: pError } = await supabase.from('products').select('*');
        if (pError) throw pError;

        const totalItems = (productsData?.length || 0) + (ads.length || 0);
        let processedItems = 0;

        if (productsData) {
          for (const product of productsData) {
            const optimizedImages = await Promise.all(
              product.images.map(async (img: string) => {
                if (img.startsWith('data:image')) {
                  return await compressImage(img);
                }
                return img;
              })
            );

            await supabase
              .from('products')
              .update({ images: optimizedImages })
              .eq('id', product.id);
            
            processedItems++;
            setOptimizationProgress(Math.round((processedItems / totalItems) * 100));
          }
        }

        // Optimize Ads
        const { data: adsData, error: aError } = await supabase.from('ads').select('*');
        if (aError) throw aError;

        if (adsData) {
          for (const ad of adsData) {
            const optimizedImages = await Promise.all(
              ad.images.map(async (img: string) => {
                if (img.startsWith('data:image')) {
                  return await compressImage(img);
                }
                return img;
              })
            );

            await supabase
              .from('ads')
              .update({ images: optimizedImages })
              .eq('id', ad.id);
            
            processedItems++;
            setOptimizationProgress(Math.round((processedItems / totalItems) * 100));
          }
        }

        showNotification('Базу даних оптимізовано!');
        fetchProducts();
        fetchAds();
      } catch (error: any) {
        console.error('Optimization error:', error);
        showNotification('Помилка оптимізації: ' + error.message, 'error');
      } finally {
        setIsOptimizing(false);
      }
    });
  };

  const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.5): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'ad') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    setIsUploading(true);
    setUploadProgress({ current: 0, total: fileList.length });

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setUploadProgress({ current: i + 1, total: fileList.length });

        // Limit to 15MB per image for initial reading on mobile, then we compress
        if (file.size > 15 * 1024 * 1024) {
          showNotification(`Файл ${file.name} занадто великий (>15MB)`, 'error');
          continue;
        }

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const compressedBase64 = await compressImage(base64, 1024, 1024, 0.6);
        
        if (type === 'product') {
          setFormData(prev => {
            if (prev.images.length >= 10) return prev;
            return { ...prev, images: [...prev.images, compressedBase64] };
          });
        } else if (type === 'ad') {
          setAdFormData(prev => {
            if (prev.images.length >= 10) return prev;
            return { ...prev, images: [...prev.images, compressedBase64] };
          });
        }
      }
      showNotification(`Завантажено ${fileList.length} фото`, 'success');
    } catch (err) {
      console.error('Upload error:', err);
      showNotification('Помилка при завантаженні фото', 'error');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8">
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md bg-white rounded-2xl shadow-2xl border border-stone-100 p-4 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <ImageIcon size={20} className="animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Обробка фото...</span>
                <span className="text-xs text-stone-500 font-mono">{uploadProgress.current} / {uploadProgress.total}</span>
              </div>
              <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-purple-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          <button 
            onClick={() => setActiveView('stats')}
            className={`pb-4 px-2 font-medium transition-all relative ${activeView === 'stats' ? 'text-stone-900' : 'text-stone-400'}`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={20} /> Статистика
            </div>
            {activeView === 'stats' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-900" />}
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
                    setFormData({ name: '', description: '', price: '', images: [], sku: '', is_sale: false, old_price: '' });
                  }}
                  className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-xl hover:bg-stone-800 transition-colors"
                >
                  <Plus size={20} /> Додати товар
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
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
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{product.name}</span>
                              {product.is_sale && (
                                <span className="text-[10px] font-bold text-red-600 uppercase">Знижка</span>
                              )}
                            </div>
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
                                  sku: product.sku,
                                  is_sale: product.is_sale || false,
                                  old_price: product.old_price?.toString() || ''
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
                  {stats?.mostViewed?.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-stone-400 font-mono text-sm">0{idx + 1}</span>
                        <span className="font-medium text-sm truncate max-w-[150px]">{item.name}</span>
                      </div>
                      <span className="text-sm text-stone-500">{item.views} переглядів</span>
                    </div>
                  ))}
                  {(!stats?.mostViewed || stats.mostViewed.length === 0) && (
                    <p className="text-sm text-stone-400 text-center py-4">Немає даних</p>
                  )}
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

            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
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
                            referrerPolicy="no-referrer"
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

            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
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

        {activeView === 'stats' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="admin-card bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                    <Users size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Зараз на сайті</p>
                    <p className="text-3xl font-bold">{stats?.onlineUsers || 0}</p>
                  </div>
                </div>
                <div className="h-1 w-full bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-1/3 animate-pulse" />
                </div>
              </div>

              <div className="admin-card bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Всього візитів</p>
                    <p className="text-3xl font-bold">{stats?.totalVisits || 0}</p>
                  </div>
                </div>
                <p className="text-xs text-stone-400">За весь час роботи магазину</p>
              </div>

              <div className="admin-card bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                    <Eye size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Переглядів товарів</p>
                    <p className="text-3xl font-bold">{stats?.totalViews || 0}</p>
                  </div>
                </div>
                <p className="text-xs text-stone-400">Сумарна кількість переглядів усіх товарів</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="admin-card bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm">
                <h3 className="text-xl font-bold mb-8">Популярність товарів</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.mostViewed || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#888' }}
                        hide
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#888' }}
                      />
                      <Tooltip 
                        cursor={{ fill: '#f9f9f9' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="views" radius={[4, 4, 4, 4]} barSize={32}>
                        {(stats?.mostViewed || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#1c1917' : '#d6d3d1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-6 space-y-3">
                  {stats?.mostViewed?.slice(0, 3).map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-stone-900' : 'bg-stone-300'}`} />
                        <span className="text-stone-600 truncate max-w-[150px]">{item.name}</span>
                      </div>
                      <span className="font-mono font-medium">{item.views}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-card bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm">
                <h3 className="text-xl font-bold mb-8">Швидкий огляд</h3>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-6 bg-stone-50 rounded-3xl border border-stone-100">
                    <p className="text-sm text-stone-500 mb-1">Товарів</p>
                    <p className="text-2xl font-bold text-stone-900">{products.length}</p>
                  </div>
                  <div className="p-6 bg-stone-50 rounded-3xl border border-stone-100">
                    <p className="text-sm text-stone-500 mb-1">Оголошень</p>
                    <p className="text-2xl font-bold text-stone-900">{ads.length}</p>
                  </div>
                  <div className="p-6 bg-stone-50 rounded-3xl border border-stone-100">
                    <p className="text-sm text-stone-500 mb-1">Відгуків</p>
                    <p className="text-2xl font-bold text-stone-900">{reviews.length}</p>
                  </div>
                  <div className="p-6 bg-stone-50 rounded-3xl border border-stone-100">
                    <p className="text-sm text-stone-500 mb-1">Знижки</p>
                    <p className="text-2xl font-bold text-red-600">{products.filter(p => p.is_sale).length}</p>
                  </div>
                </div>

                <div className="pt-8 border-t border-stone-100">
                  <h4 className="font-bold mb-4">Інструменти обслуговування</h4>
                  <button 
                    onClick={optimizeDatabase}
                    disabled={isOptimizing}
                    className="w-full flex items-center justify-center gap-2 bg-stone-100 text-stone-900 py-4 rounded-2xl font-bold hover:bg-stone-200 transition-all disabled:opacity-50"
                  >
                    <TrendingUp size={20} className={isOptimizing ? 'animate-pulse' : ''} />
                    {isOptimizing ? `Оптимізація... ${optimizationProgress}%` : 'Оптимізувати базу (Стиснути фото)'}
                  </button>
                  <p className="text-[10px] text-stone-400 mt-2 text-center">
                    Це стисне всі існуючі фото в базі даних для пришвидшення завантаження сайту.
                  </p>
                </div>
              </div>
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
                    multiple
                    className="hidden"
                  />
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {adFormData.images.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200">
                        <img src={url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="flex items-center gap-2 pt-2">
                    <input 
                      type="checkbox"
                      id="is_sale"
                      checked={formData.is_sale}
                      onChange={e => setFormData({ ...formData, is_sale: e.target.checked })}
                      className="w-5 h-5 rounded border-stone-200 text-stone-900 focus:ring-stone-900"
                    />
                    <label htmlFor="is_sale" className="text-sm font-medium text-stone-700">Товар на знижці</label>
                  </div>
                  {formData.is_sale && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-stone-700">Стара ціна (грн)</label>
                      <input 
                        type="number"
                        value={formData.old_price}
                        onChange={e => setFormData({ ...formData, old_price: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  )}
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
                        if (!formData.name) return showNotification('Спочатку введіть назву товару', 'error');
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
                          showNotification('Не вдалося згенерувати опис: ' + err.message, 'error');
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
                    multiple
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
                        <img src={url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
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
      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-medium ${
              notification.type === 'success' ? 'bg-stone-900 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(null)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center"
            >
              <h3 className="text-xl font-bold mb-4">Підтвердження</h3>
              <p className="text-stone-600 mb-8">{confirmModal.message}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 px-6 py-3 bg-stone-100 text-stone-900 rounded-xl font-bold hover:bg-stone-200 transition-colors"
                >
                  Скасувати
                </button>
                <button 
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
                >
                  Підтвердити
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
