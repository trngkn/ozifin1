'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface LightboxProps {
    images: string[];
    initialIndex?: number;
    isOpen: boolean;
    onClose: () => void;
}

export function Lightbox({ images, initialIndex = 0, isOpen, onClose }: LightboxProps) {
    const [index, setIndex] = useState(initialIndex);
    const [rotation, setRotation] = useState(0);
    const [scale, setScale] = useState(1);

    // Sync internal index with initialIndex when lightbox opens
    useEffect(() => {
        if (isOpen) {
            setIndex(initialIndex);
            setRotation(0);
            setScale(1);
        }
    }, [isOpen, initialIndex]);

    if (!isOpen) return null;

    const currentImage = images[index];

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
        setRotation(0);
        setScale(1);
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
        setRotation(0);
        setScale(1);
    };

    const handleRotate = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRotation((prev) => prev + 90);
    };

    const handleZoomIn = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale((prev) => Math.min(prev + 0.5, 3));
    };

    const handleZoomOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale((prev) => Math.max(prev - 0.5, 0.5));
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md"
                onClick={onClose}
            >
                {/* Toolbar */}
                <div
                    className="absolute top-4 right-4 flex items-center gap-3 z-[110]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex bg-white/10 rounded-full p-1 backdrop-blur-sm">
                        <button
                            type="button"
                            onClick={handleZoomOut}
                            className="p-3 hover:bg-white/20 rounded-full text-white transition-all active:scale-95"
                            title="Thu nhỏ"
                        >
                            <ZoomOut className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={handleZoomIn}
                            className="p-3 hover:bg-white/20 rounded-full text-white transition-all active:scale-95"
                            title="Phóng to"
                        >
                            <ZoomIn className="w-5 h-5" />
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleRotate}
                        className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-sm active:rotate-90"
                        title="Xoay"
                    >
                        <RotateCw className="w-6 h-6" />
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-3 bg-red-500/80 hover:bg-red-600 rounded-full text-white transition-all shadow-lg hover:shadow-red-500/30"
                        title="Đóng (Esc)"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Navigation - Left */}
                {images.length > 1 && (
                    <button
                        type="button"
                        onClick={handlePrev}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-[110] backdrop-blur-sm hover:pl-3 group"
                    >
                        <ChevronLeft className="w-8 h-8 group-hover:scale-110 transition-transform" />
                    </button>
                )}

                {/* Main Image */}
                <div
                    className="relative w-full h-full flex items-center justify-center overflow-hidden p-4 md:p-12"
                    onClick={(e) => e.stopPropagation()}
                >
                    <motion.img
                        key={currentImage}
                        src={currentImage}
                        alt="Preview"
                        className="max-w-full max-h-full object-contain cursor-grab active:cursor-grabbing"
                        style={{
                            transform: `rotate(${rotation}deg) scale(${scale})`,
                        }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        drag
                        dragConstraints={{ left: -300, right: 300, top: -300, bottom: 300 }}
                    />
                </div>

                {/* Navigation - Right */}
                {images.length > 1 && (
                    <button
                        type="button"
                        onClick={handleNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-[110] backdrop-blur-sm hover:pr-3 group"
                    >
                        <ChevronRight className="w-8 h-8 group-hover:scale-110 transition-transform" />
                    </button>
                )}

                {/* Counter */}
                {images.length > 1 && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/10 border border-white/20 px-6 py-2 rounded-full text-white font-medium backdrop-blur-md shadow-xl">
                        {index + 1} / {images.length}
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
