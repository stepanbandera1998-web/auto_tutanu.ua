import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  TrendingUp, 
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2, 
  Edit, 
  Eye, 
  Users,
  LogOut,
  Image as ImageIcon,
  X,
  Megaphone,
  Star,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  Phone,
  Send,
  MessageCircle,
  Settings,
  Search
} from 'lucide-react';
import { Product, Stats, Ad, Review, SiteSettings } from '../types';
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
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingAd, setIsAddingAd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [activeView, setActiveView] = useState<'products' | 'ads' | 'reviews' | 'stats' | 'settings'>('products');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    old_price: '',
    radius: ''
  });
  const [adFormData, setAdFormData] = useState({
    title: '',
    description: '',
    price: '',
    phone: '',
    images: [] as string[],
    is_placeholder: false,
    product_id: '' as string | number
  });

  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [dbHealth, setDbHealth] = useState<{
    products: { exists: boolean; columns: string[] };
    ads: { exists: boolean; columns: string[] };
    reviews: { exists: boolean; columns: string[] };
    stats: { exists: boolean; columns: string[] };
    site_settings: { exists: boolean; columns: string[] };
  } | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');

  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsPage, setProductsPage] = useState(0);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const PRODUCTS_PER_PAGE = 50;

  useEffect(() => {
    fetchProducts();
    fetchAds();
    fetchReviews();
    fetchStats();
    fetchSettings();
    checkDatabaseHealth();
    
    // Опитування загальної статистики
    const interval = setInterval(fetchStats, 30000); // Збільшуємо інтервал до 30с
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  const checkDatabaseHealth = async () => {
    if (!supabase) return;
    setIsCheckingHealth(true);
    try {
      const tables = ['products', 'ads', 'reviews', 'stats', 'site_settings'];
      const health: any = {};

      for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          health[table] = { exists: false, columns: [] };
        } else {
          const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
          health[table] = { exists: true, columns };
        }
      }
      setDbHealth(health);
    } catch (err) {
      console.error('Error checking DB health:', err);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const fetchSettings = async () => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .single();
      
      if (!error && data) {
        setSiteSettings(data);
      } else if (error && error.code === 'PGRST116') {
        // Налаштування не знайдено, створюємо за замовчуванням
        const { data: newData, error: createError } = await supabase
          .from('site_settings')
          .insert([{ id: '00000000-0000-0000-0000-000000000000' }])
          .select()
          .single();
        if (!createError) setSiteSettings(newData);
      }
    } catch (error) {
      console.error('Помилка отримання налаштувань:', error);
    }
  };

  const handleSaveSettings = async (newSettings: Partial<SiteSettings>) => {
    setIsSubmitting(true);
    try {
      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase
        .from('site_settings')
        .update(newSettings)
        .eq('id', siteSettings?.id || '00000000-0000-0000-0000-000000000000');
      
      if (error) throw error;
      showNotification('Налаштування збережено');
      fetchSettings();
    } catch (error: any) {
      showNotification('Помилка: ' + error.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const fetchProducts = async (page = 0) => {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      setIsLoadingProducts(true);
      console.log(`Fetching products from Supabase (page ${page})...`);
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PRODUCTS_PER_PAGE, (page + 1) * PRODUCTS_PER_PAGE - 1);
      
      if (error) {
        console.error('Supabase error fetching products:', error);
        throw error;
      }
      
      console.log(`Fetched ${data?.length || 0} products from Supabase`);
      
      if (page === 0) {
        setProducts(data || []);
      } else {
        setProducts(prev => [...prev, ...(data || [])]);
      }
      
      setProductsPage(page);
      setHasMoreProducts((data || []).length === PRODUCTS_PER_PAGE);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      showNotification('Помилка завантаження товарів: ' + (error.message || 'Невідома помилка'), 'error');
      if (page === 0) setProducts([]);
    } finally {
      setIsLoadingProducts(false);
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

  const fetchStats = async (isManual = false) => {
    if (isManual) {
      setIsRefreshingStats(true);
    }
    try {
      let visitsCount = 0;
      let totalViews = 0;
      let mostViewed: any[] = [];
      let clicks: { [key: string]: number } = {};

      if (supabase) {
        try {
          // 1. Отримуємо ТІЛЬКИ ТОП-5 товарів за переглядами
          const { data: popularData, error: pError } = await supabase
            .from('products')
            .select('id, name, views, sku')
            .order('views', { ascending: false })
            .limit(5);
          
          if (!pError && popularData) {
            mostViewed = popularData.map(p => ({
              ...p,
              name: `${p.name} [${p.sku || '---'}]`
            }));
          }

          // 2. Отримуємо суму переглядів
          const { data: viewsSumData, error: sumError } = await supabase
            .from('products')
            .select('views');
          
          if (!sumError && viewsSumData) {
            totalViews = viewsSumData.reduce((acc, p) => acc + (p.views || 0), 0);
          }

          // 3. Отримуємо статистику одним запитом
          const { data: statsData, error: statsError } = await supabase
            .from('stats')
            .select('type');
          
          if (!statsError && statsData) {
            statsData.forEach(row => {
              if (row.type === 'visit') {
                visitsCount++;
              } else if (row.type.startsWith('click_')) {
                const type = row.type.replace('click_', '');
                clicks[type] = (clicks[type] || 0) + 1;
              }
            });
          }
        } catch (err: any) {
          console.warn('Помилка отримання статистики Supabase:', err.message);
        }
      }
      
      setStats({
        totalVisits: visitsCount,
        totalViews: totalViews,
        mostViewed: mostViewed,
        onlineUsers: 0,
        clicks: clicks
      });
      
      if (isManual) {
        showNotification('Статистику оновлено');
      }
    } catch (error) {
      console.error('Error in fetchStats:', error);
    } finally {
      if (isManual) {
        setIsRefreshingStats(false);
      }
    }
  };

  const handleResetStats = async () => {
    showConfirm('Ви впевнені, що хочете обнулити всю статистику? Це дію неможливо скасувати.', async () => {
      setIsRefreshingStats(true);
      try {
        if (!supabase) throw new Error('Supabase не налаштовано');

        console.log('Скидання переглядів товарів...');
        // 1. Скидання переглядів товарів
        const { error: pError } = await supabase
          .from('products')
          .update({ views: 0 })
          .not('id', 'is', null); // Це працює як для UUID, так і для числових ID, щоб охопити всі рядки

        if (pError) {
          console.error('Помилка скидання переглядів товарів:', pError);
          throw new Error(`Помилка скидання переглядів товарів: ${pError.message}`);
        }

        console.log('Видалення статистики візитів...');
        // 2. Видалення всієї статистики візитів
        // Ми використовуємо широкий фільтр, щоб охопити всі записи візитів
        const { error: sError } = await supabase
          .from('stats')
          .delete()
          .or('type.eq.visit,type.like.click_%');

        if (sError) {
          console.error('Помилка видалення статистики візитів:', sError);
          throw new Error(`Помилка видалення візитів: ${sError.message}`);
        }

        showNotification('Статистику обнулено успішно');
        // Зачекаємо трохи перед отриманням нових даних, щоб БД встигла оновитися
        setTimeout(() => fetchStats(), 500);
      } catch (error: any) {
        console.error('Помилка при обнуленні статистики:', error);
        showNotification(error.message || 'Помилка при обнуленні статистики', 'error');
      } finally {
        setIsRefreshingStats(false);
      }
    });
  };

  const [isGenerating, setIsGenerating] = useState(false);

  const generateNextSku = (currentProducts: Product[]) => {
    if (currentProducts.length === 0) return '001';

    // Отримуємо всі SKU
    const skus = currentProducts.map(p => p.sku || '').filter(Boolean);
    if (skus.length === 0) return '001';

    // Спробуємо знайти найбільше число в будь-якому SKU
    let maxNum = 0;
    
    skus.forEach(sku => {
      // Шукаємо всі послідовності цифр
      const numbers = sku.match(/\d+/g);
      if (numbers) {
        numbers.forEach(n => {
          const val = parseInt(n);
          if (val > maxNum) maxNum = val;
        });
      }
    });

    const nextNum = maxNum + 1;
    return nextNum.toString().padStart(3, '0');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (!formData.name.trim()) throw new Error('Назва товару обов\'язкова');
      const price = parseFloat(formData.price.replace(',', '.'));
      if (isNaN(price)) throw new Error('Ціна має бути числом');

      let success = false;
      // Generate SKU if not provided
      let sku = formData.sku.trim();
      if (!sku) {
        sku = generateNextSku(products);
      }

      // Check for duplicate SKU (excluding current product if editing)
      const isDuplicateSku = products.some(p => 
        p.sku.toUpperCase() === sku.toUpperCase() && 
        (!editingProduct || p.id !== editingProduct.id)
      );
      
      if (isDuplicateSku) {
        throw new Error(`Товар з кодом "${sku}" вже існує. Будь ласка, використайте інший код.`);
      }

      const productData: any = {
        name: formData.name.trim(),
        description: formData.description,
        price,
        images: formData.images,
        sku,
        radius: formData.radius
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
            .eq('id', editingProduct.id)
            .select('*'); // Отримуємо повний об'єкт
        } else {
          result = await supabase
            .from('products')
            .insert([productData])
            .select('*'); // Отримуємо повний об'єкт
        }
        
        if (result.error) throw result.error;
        
        const returnedData = result.data?.[0];
        if (returnedData) {
          if (editingProduct) {
            setProducts(prev => prev.map(p => p.id === returnedData.id ? returnedData : p));
          } else {
            setProducts(prev => [returnedData, ...prev]);
          }
        } else {
          // Якщо select() не повернув дані, оновлюємо весь список
          await fetchProducts();
        }
        
        showNotification(editingProduct ? 'Товар оновлено!' : 'Товар опубліковано!');
        setIsAdding(false);
        setEditingProduct(null);
        setFormData({ name: '', description: '', price: '', images: [], sku: '', is_sale: false, old_price: '', radius: '' });
      } catch (error: any) {
        console.error('Помилка при відправці товару:', error);
        showNotification('Помилка: ' + error.message, 'error');
      } finally {
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error('Помилка у handleSubmit:', error);
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
      
      const adData = {
        title: adFormData.title,
        description: adFormData.description,
        price,
        phone: adFormData.phone,
        images: adFormData.images,
        is_placeholder: adFormData.is_placeholder,
        product_id: adFormData.product_id ? parseInt(adFormData.product_id.toString()) : null
      };

      if (editingAd) {
        const { error } = await supabase
          .from('ads')
          .update(adData)
          .eq('id', editingAd.id);
        
        if (error) throw error;
        
        setAds(prev => prev.map(a => a.id === editingAd.id ? { ...a, ...adData } as Ad : a));
        showNotification('Оголошення оновлено!');
      } else {
        const { data, error } = await supabase
          .from('ads')
          .insert([adData])
          .select('id, created_at');
        
        if (error) {
          if (error.message?.includes('column "is_placeholder" does not exist')) {
            throw new Error('У вашій таблиці "ads" відсутня колонка "is_placeholder". Будь ласка, додайте її (boolean, default false) або зверніться до розробника.');
          }
          if (error.message?.includes('column "product_id" does not exist')) {
            throw new Error('У вашій таблиці "ads" відсутня колонка "product_id". Будь ласка, додайте її (int8, references products.id) або зверніться до розробника.');
          }
          throw error;
        }

        if (data?.[0]) {
          const fullAd = { ...adData, ...data[0] } as Ad;
          setAds(prev => [fullAd, ...prev]);
        } else {
          fetchAds();
        }
        showNotification('Оголошення опубліковано!');
      }
      
      setIsAddingAd(false);
      setEditingAd(null);
      setAdFormData({ title: '', description: '', price: '', phone: '', images: [], is_placeholder: false, product_id: '' });
    } catch (error: any) {
      console.error('Помилка при відправці оголошення:', error);
      showNotification('Помилка: ' + error.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    showConfirm('Ви впевнені?', async () => {
      try {
        if (!supabase) throw new Error('Supabase не налаштовано');
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id);
        if (error) throw error;
        setProducts(prev => prev.filter(p => p.id !== id));
        showNotification('Товар видалено');
      } catch (error: any) {
        console.error('Помилка при видаленні товару:', error);
        showNotification('Помилка при видаленні: ' + error.message, 'error');
      }
    });
  };

  const handleDeleteAd = async (id: number | string) => {
    showConfirm('Ви впевнені?', async () => {
      try {
        if (!supabase) throw new Error('Supabase не налаштовано');
        
        const { data, error } = await supabase
          .from('ads')
          .delete()
          .eq('id', id)
          .select();
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
          showNotification('Помилка: Оголошення не видалено. Перевірте налаштування прав доступу (RLS) у Supabase для таблиці "ads".', 'error');
        } else {
          setAds(prev => prev.filter(a => a.id !== id));
          showNotification('Оголошення видалено');
        }
      } catch (error: any) {
        console.error('Помилка при видаленні оголошення:', error);
        showNotification('Помилка при видаленні: ' + (error.message || 'Невідома помилка'), 'error');
      }
    });
  };

  const handleDeleteReview = async (id: number) => {
    showConfirm('Ви впевнені, що хочете видалити цей відгук?', async () => {
      try {
        if (!supabase) throw new Error('Supabase не налаштовано');
        const { error } = await supabase
          .from('reviews')
          .delete()
          .eq('id', id);
        if (error) throw error;
        fetchReviews();
        showNotification('Відгук видалено');
      } catch (error: any) {
        console.error('Помилка при видаленні відгуку:', error);
        showNotification('Помилка при видаленні: ' + error.message, 'error');
      }
    });
  };

  const handleSeedReviews = async () => {
    showConfirm('Ви впевнені, що хочете згенерувати 50 випадкових відгуків? Це може зайняти деякий час.', async () => {
      setIsSubmitting(true);
      console.log('Початок генерації відгуків...');
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
          console.log('Відгуки успішно додані до Supabase');
        } else {
          throw new Error('Supabase не налаштовано');
        }
        
        showNotification('50 відгуків успішно згенеровано!');
        fetchReviews();
      } catch (error: any) {
        console.error('Помилка при генерації відгуків:', error);
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
        if (!supabase) throw new Error('Supabase не налаштовано');

        // Оптимізація товарів
        const { data: productsData, error: pError } = await supabase.from('products').select('*');
        if (pError) throw pError;

        const totalItems = (productsData?.length || 0) + (ads.length || 0);
        let processedItems = 0;

        if (productsData) {
          for (const product of productsData) {
            if (!Array.isArray(product.images)) {
              processedItems++;
              continue;
            }
            const optimizedImages = await Promise.all(
              product.images.map(async (img: string) => {
                if (img && typeof img === 'string' && img.startsWith('data:image')) {
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

        // Оптимізація оголошень
        const { data: adsData, error: aError } = await supabase.from('ads').select('*');
        if (aError) throw aError;

        if (adsData) {
          for (const ad of adsData) {
            if (!Array.isArray(ad.images)) {
              processedItems++;
              continue;
            }
            const optimizedImages = await Promise.all(
              ad.images.map(async (img: string) => {
                if (img && typeof img === 'string' && img.startsWith('data:image')) {
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
        console.error('Помилка оптимізації:', error);
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

        const compressedBase64 = await compressImage(base64, 800, 800, 0.5);
        
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

  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const toggleProductSelection = (id: number) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    
    showConfirm(`Ви впевнені, що хочете видалити ${selectedProductIds.length} товарів?`, async () => {
      setIsBulkDeleting(true);
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .in('id', selectedProductIds);
        
        if (error) throw error;
        
        showNotification(`Видалено ${selectedProductIds.length} товарів`, 'success');
        setSelectedProductIds([]);
        fetchProducts();
      } catch (err) {
        console.error('Bulk delete error:', err);
        showNotification('Помилка при масовому видаленні', 'error');
      } finally {
        setIsBulkDeleting(false);
      }
    });
  };

  const moveImage = (type: 'product' | 'ad', index: number, direction: 'left' | 'right') => {
    if (type === 'product') {
      const newImages = [...formData.images];
      const newIndex = direction === 'left' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newImages.length) return;
      [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
      setFormData({ ...formData, images: newImages });
    } else {
      const newImages = [...adFormData.images];
      const newIndex = direction === 'left' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newImages.length) return;
      [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
      setAdFormData({ ...adFormData, images: newImages });
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => 
      Object.values(obj).map(val => 
        typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
      ).join(',')
    );
    
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showNotification('Скопійовано в буфер обміну', 'success');
    });
  };

  const filteredAdminProducts = products.filter(p => {
    const search = adminSearchQuery.toLowerCase();
    return !search || 
      (p.name || '').toLowerCase().includes(search) ||
      (p.description || '').toLowerCase().includes(search) ||
      (p.sku || '').toLowerCase().includes(search);
  });

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
          <div className="flex items-center gap-4">
            <div 
              onClick={checkDatabaseHealth}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                dbHealth?.products?.exists ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
              title="Натисніть для перевірки стану бази даних"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${dbHealth?.products?.exists ? 'bg-emerald-500' : 'bg-red-500'} ${isCheckingHealth ? 'animate-pulse' : ''}`} />
              {isCheckingHealth ? 'Перевірка...' : (dbHealth?.products?.exists ? 'База даних: OK' : 'База даних: Помилка')}
            </div>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={20} /> Вийти
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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
          <button 
            onClick={() => setActiveView('settings')}
            className={`pb-4 px-2 font-medium transition-all relative ${activeView === 'settings' ? 'text-stone-900' : 'text-stone-400'}`}
          >
            <div className="flex items-center gap-2">
              <Settings size={20} /> Налаштування
            </div>
            {activeView === 'settings' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-900" />}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {activeView === 'products' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Product List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-semibold">Товари</h2>
                  <button 
                    onClick={() => fetchProducts(0)}
                    disabled={isLoadingProducts}
                    className={`p-2 rounded-lg hover:bg-stone-100 transition-colors ${isLoadingProducts ? 'animate-spin text-stone-300' : 'text-stone-500'}`}
                    title="Оновити список"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
                <button 
                  onClick={() => {
                    setIsAdding(true);
                    setEditingProduct(null);
                    setFormData({ name: '', description: '', price: '', images: [], sku: '', is_sale: false, old_price: '', radius: '' });
                  }}
                  className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-xl hover:bg-stone-800 transition-colors"
                >
                  <Plus size={20} /> Додати товар
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input 
                  type="text"
                  placeholder="Пошук товару за назвою або кодом..."
                  value={adminSearchQuery}
                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all"
                />
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden overflow-x-auto">
                {isLoadingProducts ? (
                  <div className="p-12 text-center">
                    <div className="w-8 h-8 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-stone-500">Завантаження товарів...</p>
                  </div>
                ) : (
                  <>
                    {selectedProductIds.length > 0 && (
                      <div className="bg-stone-900 text-white px-6 py-3 flex justify-between items-center">
                        <span className="text-sm font-medium">Вибрано: {selectedProductIds.length}</span>
                        <div className="flex gap-4">
                          <button 
                            onClick={() => setSelectedProductIds([])}
                            className="text-sm hover:underline"
                          >
                            Скасувати
                          </button>
                          <button 
                            onClick={handleBulkDelete}
                            disabled={isBulkDeleting}
                            className="bg-red-600 px-3 py-1 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors flex items-center gap-2"
                          >
                            <Trash2 size={14} /> Видалити вибрані
                          </button>
                        </div>
                      </div>
                    )}
                    <table className="w-full text-left min-w-[600px]">
                      <thead className="bg-stone-50 border-bottom border-stone-200">
                        <tr>
                          <th className="px-6 py-4 w-10">
                            <input 
                              type="checkbox"
                              checked={selectedProductIds.length === filteredAdminProducts.length && filteredAdminProducts.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProductIds(filteredAdminProducts.map(p => p.id));
                                } else {
                                  setSelectedProductIds([]);
                                }
                              }}
                              className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                            />
                          </th>
                          <th className="px-6 py-4 text-sm font-medium text-stone-500">Код</th>
                          <th className="px-6 py-4 text-sm font-medium text-stone-500">Товар</th>
                          <th className="px-6 py-4 text-sm font-medium text-stone-500">Радіус</th>
                          <th className="px-6 py-4 text-sm font-medium text-stone-500">Ціна</th>
                          <th className="px-6 py-4 text-sm font-medium text-stone-500">Перегляди</th>
                          <th className="px-6 py-4 text-sm font-medium text-stone-500 text-right">Дії</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {filteredAdminProducts.length > 0 ? filteredAdminProducts.map((product) => (
                          <tr key={product.id} className={`hover:bg-stone-50 transition-colors ${selectedProductIds.includes(product.id) ? 'bg-stone-50' : ''}`}>
                            <td className="px-6 py-4">
                              <input 
                                type="checkbox"
                                checked={selectedProductIds.includes(product.id)}
                                onChange={() => toggleProductSelection(product.id)}
                                className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs bg-stone-100 px-2 py-1 rounded text-stone-600">{product.sku}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <img 
                                  src={(Array.isArray(product.images) && product.images.length > 0) ? product.images[0] : 'https://picsum.photos/seed/car/200/200'} 
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
                            <td className="px-6 py-4">
                              <span className="text-sm font-medium text-stone-600">{product.radius || '—'}</span>
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
                                      old_price: product.old_price?.toString() || '',
                                      radius: product.radius || ''
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
                        )) : (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-stone-400">
                              <Package className="mx-auto mb-2 opacity-20" size={32} />
                              <p>{adminSearchQuery ? 'Товарів за вашим запитом не знайдено' : 'Товарів поки немає'}</p>
                              {adminSearchQuery ? (
                                <button 
                                  onClick={() => setAdminSearchQuery('')}
                                  className="mt-4 text-stone-900 font-medium hover:underline"
                                >
                                  Скинути пошук
                                </button>
                              ) : (
                                <button 
                                  onClick={() => fetchProducts(0)}
                                  className="mt-4 text-stone-900 font-medium hover:underline"
                                >
                                  Оновити список
                                </button>
                              )}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    {hasMoreProducts && products.length > 0 && (
                      <div className="p-4 border-t border-stone-100 text-center">
                        <button 
                          onClick={() => fetchProducts(productsPage + 1)}
                          disabled={isLoadingProducts}
                          className="text-stone-600 font-medium hover:text-stone-900 transition-colors disabled:opacity-50"
                        >
                          {isLoadingProducts ? 'Завантаження...' : 'Завантажити ще'}
                        </button>
                      </div>
                    )}
                  </>
                )}
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
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setEditingAd(ad);
                              setAdFormData({
                                title: ad.title,
                                description: ad.description,
                                price: ad.price.toString(),
                                phone: ad.phone,
                                images: ad.images,
                                is_placeholder: ad.is_placeholder,
                                product_id: ad.product_id || ''
                              });
                              setIsAddingAd(true);
                            }}
                            className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteAd(ad.id)}
                            className="p-2 text-stone-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
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
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Статистика магазину</h2>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => exportToCSV(products, 'products_export')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-medium hover:bg-stone-50 transition-colors"
                >
                  <TrendingUp size={14} /> Експорт товарів
                </button>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${supabase ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${supabase ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {supabase ? 'Supabase: Підключено' : 'Supabase: Помилка'}
                </div>
                <button 
                  onClick={handleResetStats}
                  disabled={isRefreshingStats}
                  className={`p-2 transition-colors bg-white rounded-xl border border-stone-200 ${isRefreshingStats ? 'text-stone-300 cursor-not-allowed' : 'text-stone-400 hover:text-red-600'}`}
                  title="Обнулити статистику"
                >
                  <RefreshCw size={20} className={isRefreshingStats ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 rounded-xl shadow-xl border border-stone-100">
                                <p className="font-bold text-stone-900">{data.name}</p>
                                <p className="text-xs text-stone-500 font-mono mb-1">Код: {data.sku}</p>
                                <p className="text-sm text-purple-600 font-semibold">{data.views} переглядів</p>
                              </div>
                            );
                          }
                          return null;
                        }}
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
                        <span className="text-stone-600 truncate max-w-[150px]">{item.name} <span className="text-[10px] text-stone-400 font-mono">({item.sku})</span></span>
                      </div>
                      <span className="font-mono font-medium">{item.views}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-card bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm">
                <h3 className="text-xl font-bold mb-8">Переходи по сайту</h3>
                <div className="space-y-4">
                  {[
                    { id: 'catalog', name: 'Каталог', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { id: 'reviews', name: 'Відгуки', icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { id: 'ads', name: 'Оголошення', icon: Megaphone, color: 'text-purple-600', bg: 'bg-purple-50' },
                    { id: 'instagram', name: 'Instagram', icon: Star, color: 'text-pink-600', bg: 'bg-pink-50' },
                    { id: 'tiktok', name: 'TikTok', icon: TrendingUp, color: 'text-stone-900', bg: 'bg-stone-100' },
                    { id: 'facebook', name: 'Facebook', icon: ShieldCheck, color: 'text-blue-800', bg: 'bg-blue-100' },
                  ].map((item) => {
                    const count = (stats?.clicks?.[item.id] || 0) + (stats?.clicks?.[`${item.id}_mobile`] || 0);
                    return (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 ${item.bg} ${item.color} rounded-lg`}>
                            <item.icon size={18} />
                          </div>
                          <span className="font-medium text-stone-700">{item.name}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-lg font-bold text-stone-900">{count}</span>
                          <span className="text-[10px] text-stone-400 uppercase tracking-wider">кліків</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="admin-card bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm">
                <h3 className="text-xl font-bold mb-8">Статистика контактів</h3>
                <div className="space-y-4">
                  {[
                    { id: 'contact_telegram', name: 'Telegram (Товари)', icon: Send, color: 'text-[#229ED9]', bg: 'bg-blue-50' },
                    { id: 'contact_whatsapp', name: 'WhatsApp (Товари)', icon: MessageCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { id: 'contact_call', name: 'Зателефонувати', icon: Phone, color: 'text-stone-900', bg: 'bg-stone-100' },
                    { id: 'ad_telegram', name: 'Telegram (Оголошення)', icon: Send, color: 'text-[#229ED9]', bg: 'bg-blue-50' },
                    { id: 'ad_whatsapp', name: 'WhatsApp (Оголошення)', icon: MessageCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  ].map((item) => {
                    const count = stats?.clicks?.[item.id] || 0;
                    return (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 ${item.bg} ${item.color} rounded-lg`}>
                            <item.icon size={18} />
                          </div>
                          <span className="font-medium text-stone-700">{item.name}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-lg font-bold text-stone-900">{count}</span>
                          <span className="text-[10px] text-stone-400 uppercase tracking-wider">запитів</span>
                        </div>
                      </div>
                    );
                  })}
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

        {activeView === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-2xl font-bold">Налаштування сайту</h2>
            
            <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm space-y-8">
              {/* Maintenance Mode */}
              <div className="flex items-center justify-between p-6 bg-stone-50 rounded-3xl border border-stone-100">
                <div className="space-y-1">
                  <h3 className="font-bold flex items-center gap-2">
                    <ShieldCheck size={20} className="text-amber-600" /> Режим обслуговування
                  </h3>
                  <p className="text-sm text-stone-500">Коли увімкнено, звичайні користувачі бачитимуть сторінку "Технічні роботи".</p>
                </div>
                <button 
                  onClick={() => handleSaveSettings({ maintenance_mode: !siteSettings?.maintenance_mode })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${siteSettings?.maintenance_mode ? 'bg-amber-600' : 'bg-stone-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${siteSettings?.maintenance_mode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <hr className="border-stone-100" />

              {/* Banner Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Megaphone size={20} className="text-purple-600" /> Рекламний банер
                </h3>
                <p className="text-sm text-stone-500">Цей банер буде відображатися у верхній частині розділу "Оголошення". Якщо фото не завантажене, банер не буде видно.</p>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">Фото банера</label>
                  <div className="flex gap-4 items-start">
                    <div className="flex-1 space-y-4">
                      <input 
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const base64 = reader.result as string;
                              const compressed = await compressImage(base64, 1200, 400);
                              handleSaveSettings({ banner_url: compressed });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                        id="banner-upload"
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => document.getElementById('banner-upload')?.click()}
                          className="bg-stone-100 text-stone-900 px-4 py-2 rounded-xl font-medium hover:bg-stone-200 transition-all flex items-center gap-2"
                        >
                          <ImageIcon size={18} /> Завантажити фото
                        </button>
                        {siteSettings?.banner_url && (
                          <button 
                            onClick={() => handleSaveSettings({ banner_url: '' })}
                            className="text-red-600 px-4 py-2 rounded-xl font-medium hover:bg-red-50 transition-all"
                          >
                            Видалити банер
                          </button>
                        )}
                      </div>
                    </div>
                    {siteSettings?.banner_url && (
                      <div className="w-48 aspect-[3/1] rounded-xl overflow-hidden border border-stone-200">
                        <img src={siteSettings.banner_url} className="w-full h-full object-cover" alt="Прев'ю банера" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <hr className="border-stone-100" />

              {/* Database Health Check */}
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <ShieldCheck size={20} className="text-emerald-600" /> Стан бази даних Supabase
                  </h3>
                  <button 
                    onClick={checkDatabaseHealth}
                    disabled={isCheckingHealth}
                    className="text-xs font-bold text-stone-500 hover:text-stone-900 flex items-center gap-1"
                  >
                    <RefreshCw size={14} className={isCheckingHealth ? 'animate-spin' : ''} /> Оновити статус
                  </button>
                </div>

                {dbHealth ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(dbHealth).map(([table, status]: [string, any]) => {
                      const requiredColumns: { [key: string]: string[] } = {
                        products: ['id', 'name', 'description', 'price', 'images', 'sku', 'radius', 'is_sale', 'old_price'],
                        ads: ['id', 'title', 'description', 'price', 'phone', 'images', 'is_placeholder', 'product_id'],
                        reviews: ['id', 'user_name', 'rating', 'comment', 'created_at'],
                        stats: ['id', 'type', 'created_at'],
                        site_settings: ['id', 'banner_url', 'catalog_header_image', 'ads_header_image']
                      };

                      const missingColumns = requiredColumns[table]?.filter(col => !status.columns.includes(col)) || [];
                      const isHealthy = status.exists && missingColumns.length === 0;

                      return (
                        <div key={table} className={`p-4 rounded-2xl border ${isHealthy ? 'border-emerald-100 bg-emerald-50/30' : 'border-red-100 bg-red-50/30'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-sm capitalize">{table}</span>
                            <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          </div>
                          {!status.exists ? (
                            <p className="text-[10px] text-red-600 font-medium">Таблиця відсутня</p>
                          ) : missingColumns.length > 0 ? (
                            <div className="space-y-1">
                              <p className="text-[10px] text-red-600 font-medium">Відсутні колонки:</p>
                              <div className="flex flex-wrap gap-1">
                                {missingColumns.map(col => (
                                  <span key={col} className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono">{col}</span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-[10px] text-emerald-600 font-medium">Все в порядку</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                    <p className="text-stone-400 text-sm">Натисніть "Оновити статус" для перевірки бази даних</p>
                  </div>
                )}

                {dbHealth && Object.values(dbHealth).some((s: any) => !s.exists || (s.columns.length < 5)) && (
                  <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
                    <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                      <Settings size={18} /> Як виправити помилки?
                    </h4>
                    <p className="text-sm text-amber-700 mb-4">
                      Скопіюйте цей SQL-запит та виконайте його у <b>SQL Editor</b> вашої панелі Supabase:
                    </p>
                    <div className="bg-stone-900 p-4 rounded-xl overflow-x-auto relative group">
                      <button 
                        onClick={() => copyToClipboard(`-- Створення таблиць та додавання відсутніх колонок
CREATE TABLE IF NOT EXISTS products (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL NOT NULL,
  images TEXT[] DEFAULT '{}',
  sku TEXT UNIQUE,
  radius TEXT,
  is_sale BOOLEAN DEFAULT FALSE,
  old_price DECIMAL,
  views BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS ads (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL NOT NULL,
  phone TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  is_placeholder BOOLEAN DEFAULT FALSE,
  product_id BIGINT REFERENCES products(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS stats (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_url TEXT,
  catalog_header_image TEXT,
  ads_header_image TEXT,
  maintenance_mode BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Додавання колонок, якщо таблиці вже існують
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS radius TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_sale BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS old_price DECIMAL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS views BIGINT DEFAULT 0;

ALTER TABLE ads ADD COLUMN IF NOT EXISTS is_placeholder BOOLEAN DEFAULT FALSE;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS product_id BIGINT REFERENCES products(id);
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT FALSE;`)}
                        className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Копіювати SQL"
                      >
                        <Plus size={16} />
                      </button>
                      <pre className="text-[10px] text-emerald-400 font-mono leading-relaxed">
{`-- Створення таблиць та додавання відсутніх колонок
CREATE TABLE IF NOT EXISTS products (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL NOT NULL,
  images TEXT[] DEFAULT '{}',
  sku TEXT UNIQUE,
  radius TEXT,
  is_sale BOOLEAN DEFAULT FALSE,
  old_price DECIMAL,
  views BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS ads (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL NOT NULL,
  phone TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  is_placeholder BOOLEAN DEFAULT FALSE,
  product_id BIGINT REFERENCES products(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS stats (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_url TEXT,
  catalog_header_image TEXT,
  ads_header_image TEXT,
  maintenance_mode BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Додавання колонок, якщо таблиці вже існують
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS radius TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_sale BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS old_price DECIMAL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS views BIGINT DEFAULT 0;

ALTER TABLE ads ADD COLUMN IF NOT EXISTS is_placeholder BOOLEAN DEFAULT FALSE;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS product_id BIGINT REFERENCES products(id);
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT FALSE;`}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              <hr className="border-stone-100" />

              {/* Header Images Settings */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ImageIcon size={20} className="text-blue-600" /> Фонові зображення розділів
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Catalog Header */}
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-stone-700">Фон Каталогу</label>
                    <div className="aspect-video rounded-2xl overflow-hidden border border-stone-200 bg-stone-50 relative group">
                      <img 
                        src={siteSettings?.catalog_header_image || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=1920"} 
                        className="w-full h-full object-cover" 
                        alt="" 
                        referrerPolicy="no-referrer"
                      />
                      <button 
                        onClick={() => document.getElementById('catalog-header-upload')?.click()}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold gap-2"
                      >
                        <Edit size={20} /> Змінити
                      </button>
                      <input 
                        type="file"
                        id="catalog-header-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const base64 = reader.result as string;
                              const compressed = await compressImage(base64, 1920, 1080);
                              handleSaveSettings({ catalog_header_image: compressed });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Ads Header */}
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-stone-700">Фон Оголошень</label>
                    <div className="aspect-video rounded-2xl overflow-hidden border border-stone-200 bg-stone-50 relative group">
                      <img 
                        src={siteSettings?.ads_header_image || "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=1920"} 
                        className="w-full h-full object-cover" 
                        alt="" 
                        referrerPolicy="no-referrer"
                      />
                      <button 
                        onClick={() => document.getElementById('ads-header-upload')?.click()}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold gap-2"
                      >
                        <Edit size={20} /> Змінити
                      </button>
                      <input 
                        type="file"
                        id="ads-header-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const base64 = reader.result as string;
                              const compressed = await compressImage(base64, 1920, 1080);
                              handleSaveSettings({ ads_header_image: compressed });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                  </div>
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
                <h3 className="text-lg sm:text-xl font-bold">{editingAd ? 'Редагувати оголошення' : 'Додати оголошення'}</h3>
                <button onClick={() => { setIsAddingAd(false); setEditingAd(null); }} className="text-stone-400 hover:text-stone-900 p-1">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleAdSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Заголовок</label>
                    <input 
                      required
                      id="ad_title"
                      name="title"
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
                      id="ad_price"
                      name="price"
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
                      id="ad_phone"
                      name="phone"
                      type="text"
                      value={adFormData.phone}
                      onChange={e => setAdFormData({ ...adFormData, phone: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Прив'язати товар (опціонально)</label>
                    <select 
                      id="ad_product_id"
                      name="product_id"
                      value={adFormData.product_id}
                      onChange={e => setAdFormData({ ...adFormData, product_id: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none"
                    >
                      <option value="">Не вибрано</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox"
                    id="is_placeholder"
                    name="is_placeholder"
                    checked={adFormData.is_placeholder}
                    onChange={e => setAdFormData({ ...adFormData, is_placeholder: e.target.checked })}
                    className="w-5 h-5 rounded border-stone-200 text-stone-900 focus:ring-stone-900"
                  />
                  <label htmlFor="is_placeholder" className="text-sm font-medium text-stone-700">Це заглушка (замальоване)</label>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">Опис</label>
                  <textarea 
                    required
                    id="ad_description"
                    name="description"
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
                    id="ad_images"
                    name="images"
                    ref={adFileInputRef}
                    onChange={(e) => handleFileUpload(e, 'ad')}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {adFormData.images.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200 group">
                        <img src={url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <button 
                            type="button"
                            onClick={() => moveImage('ad', idx, 'left')}
                            disabled={idx === 0}
                            className="p-1 bg-white/20 hover:bg-white/40 rounded text-white disabled:opacity-30"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => moveImage('ad', idx, 'right')}
                            disabled={idx === adFormData.images.length - 1}
                            className="p-1 bg-white/20 hover:bg-white/40 rounded text-white disabled:opacity-30"
                          >
                            <ChevronRight size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setAdFormData({ ...adFormData, images: adFormData.images.filter((_, i) => i !== idx) })}
                            className="p-1 bg-red-600/80 hover:bg-red-600 rounded text-white"
                          >
                            <X size={14} />
                          </button>
                        </div>
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
                  {isSubmitting ? 'Публікація...' : (editingAd ? 'Зберегти зміни' : 'Опублікувати оголошення')}
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
                      id="product_name"
                      name="name"
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
                      id="product_price"
                      name="price"
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
                      name="is_sale"
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
                        id="product_old_price"
                        name="old_price"
                        type="number"
                        value={formData.old_price}
                        onChange={e => setFormData({ ...formData, old_price: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-stone-700">Код товару (SKU)</label>
                      <button 
                        type="button"
                        onClick={() => {
                          const generated = generateNextSku(products);
                          setFormData({ ...formData, sku: generated });
                        }}
                        className="text-[10px] font-bold text-stone-400 hover:text-stone-900 uppercase tracking-wider"
                      >
                        Згенерувати
                      </button>
                    </div>
                    <input 
                      id="product_sku"
                      name="sku"
                      type="text"
                      value={formData.sku}
                      onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none font-mono"
                      placeholder="Автоматично (напр. 001)"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Радіус коліс</label>
                    <select 
                      id="product_radius"
                      name="radius"
                      value={formData.radius}
                      onChange={e => setFormData({ ...formData, radius: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none"
                    >
                      <option value="">Виберіть радіус</option>
                      {['R13', 'R14', 'R15', 'R16', 'R17', 'R18'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
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
                    id="product_description"
                    name="description"
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
                    id="product_images_file"
                    name="images_file"
                    ref={fileInputRef}
                    onChange={(e) => handleFileUpload(e, 'product')}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />

                  <div className="flex gap-2">
                    <input 
                      id="product_image_url"
                      name="image_url"
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
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200 group">
                        <img src={url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <button 
                            type="button"
                            onClick={() => moveImage('product', idx, 'left')}
                            disabled={idx === 0}
                            className="p-1 bg-white/20 hover:bg-white/40 rounded text-white disabled:opacity-30"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => moveImage('product', idx, 'right')}
                            disabled={idx === formData.images.length - 1}
                            className="p-1 bg-white/20 hover:bg-white/40 rounded text-white disabled:opacity-30"
                          >
                            <ChevronRight size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setFormData({ ...formData, images: formData.images.filter((_, i) => i !== idx) })}
                            className="p-1 bg-red-600/80 hover:bg-red-600 rounded text-white"
                          >
                            <X size={14} />
                          </button>
                        </div>
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
