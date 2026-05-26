'use client';

import Image from 'next/image';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, Share2, Star, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/lib/store/useCartStore';
import { toast } from 'sonner';

interface Product {
    id: number;
    name: string;
    description: string;
    price: number;
    image: string;
    gallery: string[];
    sku: string;
    inStock: boolean;
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const addToCart = useCartStore(state => state.addToCart);

    useEffect(() => {
        fetch(`/api/products/${id}`)
            .then(res => res.json())
            .then(data => setProduct(data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [id]);

    const handleAddToCart = () => {
        if (!product) return;
        addToCart({
            productId: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: quantity,
        });
        toast.success("Savatga qo'shildi");
    };

    if (loading) {
        return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
    }

    if (!product) {
        return <div className="min-h-screen flex items-center justify-center">Mahsulot topilmadi</div>;
    }

    return (
        <div className="bg-white min-h-screen pb-24 relative">
            {/* Header Image Area */}
            <div className="relative bg-gray-100 h-[360px]">
                <div className="absolute top-4 left-4 z-10">
                    <button onClick={() => router.back()} className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm text-gray-700" aria-label="Orqaga">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                </div>
                <div className="absolute top-4 right-4 z-10 flex gap-3">
                    <button className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm text-gray-700" aria-label="Ulashish">
                        <Share2 className="w-5 h-5" />
                    </button>
                    <button className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm text-gray-700" aria-label="Sevimlilarga qo'shish">
                        <Heart className="w-5 h-5" />
                    </button>
                </div>
                <Image
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-contain mix-blend-multiply" width={300} height={300}
                />
            </div>

            {/* Content */}
            <div className="p-5 -mt-6 bg-white rounded-t-[32px] relative z-20">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>

                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 leading-tight mb-2">{product.name}</h1>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium text-gray-900">4.8</span>
                            <span>(120 sharh)</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-brand-green">{product.price.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">so&apos;m / dona</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Description */}
                    <div>
                        <h3 className="font-bold text-gray-900 mb-2">Tavsif</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            {product.description || "Tavsif mavjud emas"}
                        </p>
                    </div>

                    {/* Characteristics (Mock) */}
                    <div>
                        <h3 className="font-bold text-gray-900 mb-3">Xususiyatlari</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm py-2 border-b border-gray-50">
                                <span className="text-gray-500">SKU</span>
                                <span className="font-medium text-gray-900">{product.sku || '-'}</span>
                            </div>
                            <div className="flex justify-between text-sm py-2 border-b border-gray-50">
                                <span className="text-gray-500">Holati</span>
                                <span className="font-medium text-green-600">Sotuvda bor</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-safe-area-inset-bottom flex gap-4 z-50">
                <div className="flex items-center bg-gray-100 rounded-xl px-2 h-12">
                    <button
                        className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-600 active:scale-95 transition-transform"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        aria-label="Kamaytirish"
                    >
                        <Minus className="w-5 h-5" />
                    </button>
                    <span className="w-8 text-center font-bold text-gray-900">{quantity}</span>
                    <button
                        className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-600 active:scale-95 transition-transform"
                        onClick={() => setQuantity(quantity + 1)}
                        aria-label="Ko'paytirish"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                <button
                    onClick={handleAddToCart}
                    className="flex-1 bg-brand-purple text-white rounded-xl h-12 font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-purple/30 active:scale-[0.98] transition-transform"
                >
                    <ShoppingCart className="w-5 h-5" />
                    Savatga qo&apos;shish
                </button>
            </div>
        </div>
    );
}
