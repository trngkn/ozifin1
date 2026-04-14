'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Notification } from '@/types';
import { Bell } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

export function NotificationBell({ currentUser }: { currentUser: { username: string } }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const router = useRouter();

    const loadNotifications = async () => {
        if (!currentUser) return;
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.username)
            .eq('is_read', false)
            .order('created_at', { ascending: false });
        if (data) setNotifications(data);
    };

    useEffect(() => {
        if (currentUser) {
            loadNotifications();
            // Subscribe to real-time changes
            const channel = supabase
                .channel('notifications-changes')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${currentUser.username}`,
                    },
                    (payload) => {
                        setNotifications((prev) => [payload.new as Notification, ...prev]);
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [currentUser]);

    const handleNotificationClick = async (notif: Notification) => {
        setShowNotifications(false);
        // Mark as read
        await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
        setNotifications(notifications.filter(n => n.id !== notif.id));

        if (notif.link) {
            router.push(notif.link);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors relative"
            >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-slate-900"></span>
                )}
            </button>

            {showNotifications && (
                <div className="absolute left-0 md:left-auto md:right-auto top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in zoom-in-95 text-gray-800 ml-2 md:ml-0">
                    <h3 className="font-bold text-gray-700 px-3 py-2 border-b border-gray-50 mb-1">Thông báo</h3>
                    <div className="max-h-[300px] overflow-y-auto space-y-1">
                        {notifications.length === 0 ? (
                            <p className="text-gray-400 text-sm text-center py-4">Không có thông báo mới</p>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n.id}
                                    onClick={() => handleNotificationClick(n)}
                                    className="p-3 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors text-left"
                                >
                                    <div className="text-sm font-bold text-gray-800">{n.title}</div>
                                    <div className="text-xs text-gray-500 line-clamp-2">{n.message}</div>
                                    <div className="text-[10px] text-gray-400 mt-1">{format(new Date(n.created_at), 'HH:mm dd/MM/yyyy')}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
