'use client';

import { useState, useRef, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority, User, TaskComment, TaskHistory } from '@/types';
import { supabase } from '@/lib/supabase';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Plus, MoreHorizontal, Calendar, User as UserIcon, MessageSquare, Clock, Paperclip, X, History, Bell } from 'lucide-react';
import { RichEditor } from '@/components/RichEditor';
import toast from 'react-hot-toast';

const STATUS_COLUMNS: { id: TaskStatus; title: string, color: string }[] = [
    { id: 'todo', title: 'Cần làm', color: 'bg-gray-100' },
    { id: 'in_progress', title: 'Đang làm', color: 'bg-blue-50' },
    { id: 'review', title: 'Review', color: 'bg-yellow-50' },
    { id: 'done', title: 'Hoàn thành', color: 'bg-green-50' },
];

const PRIORITY_COLORS = {
    low: 'bg-slate-100 text-slate-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
};

// --- Components ---

function TaskModal({
    task,
    isOpen,
    onClose,
    onUpdate,
    currentUser,
    users
}: {
    task: Task | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (updatedTask?: Task) => void;
    currentUser: User | null;
    users: User[];
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<TaskStatus>('todo');
    const [priority, setPriority] = useState<TaskPriority>('medium');
    const [assignees, setAssignees] = useState<string[]>([]);
    const [dueDate, setDueDate] = useState('');

    // Comments & History
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [history, setHistory] = useState<TaskHistory[]>([]);
    const [newComment, setNewComment] = useState('');
    const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'history'>('details');

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setDescription(task.description || '');
            setStatus(task.status);
            setPriority(task.priority);
            setAssignees(task.assignees || []);
            setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
            setIsEditing(false); // Default to view mode
            loadComments(task.id);
            loadHistory(task.id);
        } else {
            // New task defaults
            setTitle('');
            setDescription('');
            setStatus('todo');
            setPriority('medium');
            setAssignees([]);
            setDueDate('');
            setIsEditing(true);
            setComments([]);
            setHistory([]);
        }
        setActiveTab('details');
    }, [task, isOpen]);

    const loadComments = async (taskId: string) => {
        const { data } = await supabase
            .from('task_comments')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: true });
        if (data) setComments(data);
    };

    const loadHistory = async (taskId: string) => {
        const { data } = await supabase
            .from('task_history')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: false });
        if (data) setHistory(data);
    };

    const handleSave = async () => {
        if (!currentUser) return;
        if (!title.trim()) {
            toast.error('Tiêu đề không được để trống');
            return;
        }

        const taskData = {
            title,
            description,
            status,
            priority,
            assignees,
            due_date: dueDate ? new Date(dueDate).toISOString() : null,
            updated_at: new Date().toISOString(),
        };

        try {
            if (task) {
                // Update
                const { error } = await supabase
                    .from('tasks')
                    .update(taskData)
                    .eq('id', task.id);
                if (error) throw error;

                // Log history
                await supabase.from('task_history').insert({
                    task_id: task.id,
                    user_id: currentUser.username,
                    action: 'updated',
                    details: 'Cập nhật nội dung công việc'
                });

                // Notify new assignees
                const newAssignees = assignees.filter(a => !task.assignees?.includes(a) && a !== currentUser.username);
                // Simple notification insert
                if (newAssignees.length > 0) {
                    await supabase.from('notifications').insert(
                        newAssignees.map(u => ({
                            user_id: u,
                            title: 'Giao việc mới',
                            message: `${currentUser.display_name} đã giao việc "${title}" cho bạn`,
                            link: `/dashboard/tasks?taskId=${task.id}`
                        }))
                    );
                }

                toast.success('Đã cập nhật công việc');
                onUpdate({ ...task, ...taskData, due_date: taskData.due_date || undefined });
            } else {
                // Create
                const { data, error } = await supabase
                    .from('tasks')
                    .insert({
                        ...taskData,
                        created_by: currentUser.username,
                        created_at: new Date().toISOString(),
                    })
                    .select()
                    .single();
                if (error) throw error;

                // Log history
                await supabase.from('task_history').insert({
                    task_id: data.id,
                    user_id: currentUser.username,
                    action: 'created',
                    details: 'Tạo mới công việc'
                });

                // Notify assignees
                if (assignees.length > 0) {
                    await supabase.from('notifications').insert(
                        assignees.filter(u => u !== currentUser.username).map(u => ({
                            user_id: u,
                            title: 'Giao việc mới',
                            message: `${currentUser.display_name} đã giao việc "${title}" cho bạn`,
                            link: `/dashboard/tasks?taskId=${data.id}`
                        }))
                    );
                }

                toast.success('Đã tạo công việc mới');
                onUpdate();
            }
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error('Lỗi khi lưu công việc');
        }
    };

    const handleDelete = async () => {
        if (!task || !confirm('Bạn chắc chắn muốn xoá công việc này?')) return;
        try {
            await supabase.from('tasks').delete().eq('id', task.id);
            toast.success('Đã xoá công việc');
            onUpdate(undefined); // undefined triggers refresh/remove
            onClose();
        } catch (error) {
            toast.error('Lỗi khi xoá');
        }
    };

    const postComment = async () => {
        if (!task || !newComment.trim() || !currentUser) return;
        try {
            const { data, error } = await supabase
                .from('task_comments')
                .insert({
                    task_id: task.id,
                    user_id: currentUser.username,
                    content: newComment
                })
                .select()
                .single();
            if (error) throw error;

            setComments([...comments, data]);
            setNewComment('');

            // Notify other assignees except commenter
            const recipients = task.assignees?.filter(u => u !== currentUser.username) || [];
            if (recipients.length > 0) {
                await supabase.from('notifications').insert(
                    recipients.map(u => ({
                        user_id: u,
                        title: 'Bình luận mới',
                        message: `${currentUser.display_name} bình luận công việc "${task.title}"`,
                        link: `/dashboard/tasks?taskId=${task.id}`
                    }))
                );
            }

        } catch (err) {
            console.error(err);
            toast.error('Gửi bình luận thất bại');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-7xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    {isEditing ? (
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Tiêu đề công việc"
                            className="text-xl font-bold w-full border-none focus:ring-0 outline-none placeholder-gray-300"
                        />
                    ) : (
                        <h2 className="text-xl font-bold">{title}</h2>
                    )}
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
                    {/* Main Content */}
                    <div className="flex-1 space-y-6">
                        {/* Tabs */}
                        <div className="flex gap-4 border-b border-gray-100 pb-2">
                            <button onClick={() => setActiveTab('details')} className={`pb-2 font-bold text-sm ${activeTab === 'details' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}>Chi tiết</button>
                            <button onClick={() => setActiveTab('comments')} className={`pb-2 font-bold text-sm flex items-center gap-2 ${activeTab === 'comments' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}>
                                Bình luận <span className="bg-gray-100 px-2 rounded-full text-xs">{comments.length}</span>
                            </button>
                            <button onClick={() => setActiveTab('history')} className={`pb-2 font-bold text-sm ${activeTab === 'history' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}>Lịch sử</button>
                        </div>

                        {activeTab === 'details' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Mô tả công việc</label>
                                    <RichEditor
                                        key={task ? task.id : 'new-task'}
                                        content={description}
                                        onChange={setDescription}
                                        editable={isEditing}
                                    />
                                </div>
                                {isEditing && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Trạng thái</label>
                                            <select
                                                value={status}
                                                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                                                className="w-full p-2 border rounded-xl"
                                            >
                                                {STATUS_COLUMNS.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Độ ưu tiên</label>
                                            <select
                                                value={priority}
                                                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                                                className="w-full p-2 border rounded-xl"
                                            >
                                                <option value="low">Thấp</option>
                                                <option value="medium">Trung bình</option>
                                                <option value="high">Cao</option>
                                                <option value="urgent">Khẩn cấp</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'comments' && (
                            <div className="space-y-4">
                                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                                    {comments.length === 0 && <p className="text-gray-400 text-center py-4">Chưa có bình luận nào</p>}
                                    {comments.map(c => (
                                        <div key={c.id} className="flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-xs shrink-0">
                                                {c.user_id.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded-xl rounded-tl-none">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-sm text-gray-800">{c.user_id}</span>
                                                    <span className="text-xs text-gray-400">{format(new Date(c.created_at), 'HH:mm dd/MM/yyyy')}</span>
                                                </div>
                                                <p className="text-gray-700 text-sm whitespace-pre-wrap">{c.content}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2 items-end">
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Viết bình luận..."
                                        className="flex-1 p-3 border rounded-xl focus:ring-2 ring-indigo-500 focus:outline-none resize-none"
                                        rows={2}
                                    />
                                    <button
                                        onClick={postComment}
                                        disabled={!newComment.trim()}
                                        className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        <MessageSquare className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="space-y-4">
                                {history.map(h => (
                                    <div key={h.id} className="flex gap-3 text-sm">
                                        <History className="w-4 h-4 text-gray-400 mt-1" />
                                        <div>
                                            <p className="text-gray-800">
                                                <span className="font-bold">{h.user_id}</span> {h.action === 'created' ? 'đã tạo' : 'đã cập nhật'}: {h.details}
                                            </p>
                                            <span className="text-xs text-gray-400">{format(new Date(h.created_at), 'HH:mm dd/MM/yyyy')}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar Info */}
                    <div className="w-full md:w-72 space-y-6 border-l border-gray-100 pl-6">
                        <div>
                            <label className="block text-xs uppercase font-bold text-gray-400 mb-2">Người thực hiện</label>
                            {isEditing ? (
                                <div className="space-y-1 max-h-40 overflow-y-auto border p-2 rounded-lg">
                                    {users.map(u => (
                                        <label key={u.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={assignees.includes(u.username)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setAssignees([...assignees, u.username]);
                                                    else setAssignees(assignees.filter(a => a !== u.username));
                                                }}
                                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm">{u.display_name}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {assignees.length > 0 ? assignees.map(u => (
                                        <div key={u} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full text-xs font-medium">
                                            <UserIcon className="w-3 h-3" /> {u}
                                        </div>
                                    )) : <span className="text-sm text-gray-400 italic">Chưa giao cho ai</span>}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs uppercase font-bold text-gray-400 mb-2">Hạn hoàn thành</label>
                            {isEditing ? (
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="w-full p-2 border rounded-lg text-sm"
                                />
                            ) : (
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <Calendar className="w-4 h-4" />
                                    {dueDate ? format(new Date(dueDate), 'dd/MM/yyyy') : '---'}
                                </div>
                            )}
                        </div>

                        {!isEditing && (
                            <div className="space-y-2 pt-4 border-t border-gray-100">
                                <label className="block text-xs uppercase font-bold text-gray-400 mb-2">Thông tin thêm</label>
                                <div className="text-sm text-gray-600">
                                    Trạng thái: <span className="font-medium">{STATUS_COLUMNS.find(s => s.id === status)?.title}</span>
                                </div>
                                <div className="text-sm text-gray-600">
                                    Ưu tiên: <span className={`font-medium px-2 py-0.5 rounded text-xs ${PRIORITY_COLORS[priority]}`}>{priority.toUpperCase()}</span>
                                </div>
                            </div>
                        )}

                        <div className="pt-8">
                            {isEditing ? (
                                <div className="flex gap-2">
                                    <button onClick={handleSave} className="flex-1 bg-indigo-600 text-white font-bold py-2 rounded-xl hover:bg-indigo-700">Lưu</button>
                                    <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl hover:bg-gray-200">Huỷ</button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={() => setIsEditing(true)} className="flex-1 bg-indigo-50 text-indigo-600 font-bold py-2 rounded-xl hover:bg-indigo-100 border border-indigo-200">Sửa</button>
                                    <button onClick={handleDelete} className="flex-1 bg-red-50 text-red-600 font-bold py-2 rounded-xl hover:bg-red-100 border border-red-200">Xoá</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function KanbanPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filterUser, setFilterUser] = useState<string>('');
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        const userData = localStorage.getItem('ozifin_user');
        if (userData) {
            setCurrentUser(JSON.parse(userData));
        }
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [tasksRes, usersRes] = await Promise.all([
            supabase.from('tasks').select('*').order('index'),
            supabase.from('users').select('*')
        ]);

        if (tasksRes.data) setTasks(tasksRes.data);
        if (usersRes.data) setUsers(usersRes.data);
        setLoading(false);
    };



    const handleDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) return;

        const startStatus = source.droppableId as TaskStatus;
        const finishStatus = destination.droppableId as TaskStatus;

        // Clone tasks
        const newTasks = Array.from(tasks);
        const taskIndex = newTasks.findIndex(t => t.id === draggableId);
        const task = newTasks[taskIndex];

        // Optimistic update
        const updatedTask = { ...task, status: finishStatus };
        newTasks.splice(taskIndex, 1); // remove from old position

        // Find correct insertion index in the new list logic is complex with mixed types in array
        // Simplification: just update status and let DB fetch handle sorting if implemented fully, 
        // OR better: locally filter by status to find index.
        // For now, simpler implementation: Update status in DB, then reload or update local state simply.
        // Let's just update the status locally for visual feedback.

        updatedTask.status = finishStatus;
        newTasks.splice(destination.index, 0, updatedTask); // insert ? No, index is relative to column. 
        // The array is flat, so `splice` with destination.index works only if we filtered columns. 
        // Correct way for flat array:

        // Update local state without reordering array for now, just change status
        const properNewTasks = tasks.map(t => {
            if (t.id === draggableId) return { ...t, status: finishStatus };
            return t;
        });

        setTasks(properNewTasks);

        // Update DB
        if (currentUser) {
            await supabase.from('tasks').update({ status: finishStatus }).eq('id', draggableId);
            await supabase.from('task_history').insert({
                task_id: draggableId,
                user_id: currentUser.username,
                action: 'moved',
                details: `Đã chuyển từ ${STATUS_COLUMNS.find(s => s.id === startStatus)?.title} sang ${STATUS_COLUMNS.find(s => s.id === finishStatus)?.title}`
            });

            // Notify if moved to Done
            if (finishStatus === 'done' && task.created_by !== currentUser.username) {
                await supabase.from('notifications').insert({
                    user_id: task.created_by,
                    title: 'Công việc hoàn thành',
                    message: `${currentUser.display_name} đã hoàn thành "${task.title}"`,
                    link: `/dashboard/tasks?taskId=${task.id}`
                });
            }
        }
    };

    const openNewTaskModal = () => {
        setSelectedTask(null);
        setIsModalOpen(true);
    };

    const openEditTaskModal = (task: Task) => {
        setSelectedTask(task);
        setIsModalOpen(true);
    };

    const filteredTasks = tasks.filter(t => {
        if (!filterUser) return true;
        return t.assignees?.includes(filterUser);
    });

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 px-1">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 flex items-center gap-2">
                        Quản Lý Công Việc
                        <span className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold">{tasks.length}</span>
                    </h1>
                </div>
                <div className="flex gap-3">
                    <select
                        value={filterUser}
                        onChange={(e) => setFilterUser(e.target.value)}
                        className="border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 ring-indigo-500 outline-none"
                    >
                        <option value="">Tất cả mọi người</option>
                        {users.map(u => <option key={u.id} value={u.username}>{u.display_name}</option>)}
                    </select>
                    <button
                        onClick={openNewTaskModal}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-200"
                    >
                        <Plus className="w-5 h-5" /> Thêm việc
                    </button>

                </div>
            </div>

            {/* Kanban Board */}
            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                    <div className="flex h-full gap-6 min-w-[1000px]">
                        {STATUS_COLUMNS.map(column => {
                            const columnTasks = filteredTasks.filter(t => t.status === column.id);

                            return (
                                <div key={column.id} className="w-80 flex flex-col h-full">
                                    <div className={`flex items-center justify-between p-3 rounded-t-xl border-b-2 border-white ${column.color}`}>
                                        <h3 className="font-bold text-gray-700">{column.title}</h3>
                                        <span className="bg-white/50 px-2 py-0.5 rounded text-xs font-bold text-gray-600">{columnTasks.length}</span>
                                    </div>
                                    <Droppable droppableId={column.id}>
                                        {(provided, snapshot) => (
                                            <div
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className={`flex-1 p-2 rounded-b-xl transition-colors overflow-y-auto ${snapshot.isDraggingOver ? 'bg-indigo-50' : 'bg-gray-50/50'}`}
                                            >
                                                {columnTasks.map((task, index) => (
                                                    <Draggable key={task.id} draggableId={task.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                onClick={() => openEditTaskModal(task)}
                                                                className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-3 cursor-pointer group hover:shadow-md transition-all relative ${snapshot.isDragging ? 'rotate-2 shadow-xl ring-2 ring-indigo-500 z-50' : ''}`}
                                                                style={provided.draggableProps.style}
                                                            >
                                                                <div className={`inline-block px-2 py-0.5 rounded text-xs font-bold mb-2 ${PRIORITY_COLORS[task.priority]}`}>
                                                                    {task.priority === 'urgent' ? 'KHẨN CẤP' : task.priority.toUpperCase()}
                                                                </div>
                                                                <h4 className="font-bold text-gray-800 mb-2 line-clamp-2">{task.title}</h4>
                                                                <div className="flex items-center justify-between text-xs text-gray-400 mt-3">
                                                                    <div className="flex items-center gap-2">
                                                                        {task.assignees?.length > 0 ? (
                                                                            <div className="flex -space-x-2">
                                                                                {task.assignees.slice(0, 3).map((u, i) => (
                                                                                    <div key={i} className="w-6 h-6 rounded-full bg-indigo-100 border border-white flex items-center justify-center text-[10px] font-bold text-indigo-700">
                                                                                        {u.substring(0, 1).toUpperCase()}
                                                                                    </div>
                                                                                ))}
                                                                                {task.assignees.length > 3 && <div className="w-6 h-6 rounded-full bg-gray-100 border border-white flex items-center justify-center text-[10px] font-bold">+{task.assignees.length - 3}</div>}
                                                                            </div>
                                                                        ) : <span>Chưa giao</span>}
                                                                    </div>
                                                                    {task.due_date && <div className={`flex items-center gap-1 ${new Date(task.due_date) < new Date() ? 'text-red-500' : ''}`}><Clock className="w-3 h-3" /> {format(new Date(task.due_date), 'dd/MM')}</div>}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </DragDropContext>

            {/* TaskModal */}
            {isModalOpen && (
                <TaskModal
                    key={selectedTask ? selectedTask.id : `new-task-${Date.now()}`}
                    task={selectedTask}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onUpdate={(updated) => {
                        loadData();
                    }}
                    currentUser={currentUser}
                    users={users}
                />
            )}
        </div>
    );
}
