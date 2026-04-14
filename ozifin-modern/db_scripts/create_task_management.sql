-- Create ENUMs
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- TASKS TABLE
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT, -- HTML content from Tiptap
    status task_status NOT NULL DEFAULT 'todo',
    priority task_priority NOT NULL DEFAULT 'medium',
    assignees TEXT[], -- Array of usernames to simplify tagging
    tags TEXT[],
    due_date TIMESTAMPTZ,
    created_by TEXT NOT NULL, -- username
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    "index" INTEGER DEFAULT 0 -- For ordering in Kanban column
);

-- TASK COMMENTS
CREATE TABLE task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- username
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TASK HISTORY (Audit Log)
CREATE TABLE task_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- username who performed action
    action TEXT NOT NULL, -- 'created', 'updated_status', 'commented', 'assigned', etc.
    details TEXT, -- readable string or JSON
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL, -- username receiving notification
    title TEXT NOT NULL,
    message TEXT,
    link TEXT, -- e.g. /dashboard/tasks?taskId=...
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignees ON tasks USING GIN(assignees);
CREATE INDEX idx_notifications_user ON notifications(user_id) WHERE is_read = FALSE;

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies for Tasks
CREATE POLICY "Tasks visible to everyone" ON tasks FOR SELECT USING (true);
CREATE POLICY "Tasks accessible by authenticated" ON tasks FOR ALL USING (auth.role() = 'authenticated');
-- Note: In a real app we might restrict this, but for this internal tool, openness is fine. We can refine later.

-- Policies for Comments
CREATE POLICY "Comments visible to everyone" ON task_comments FOR SELECT USING (true);
CREATE POLICY "Comments insertable by authenticated" ON task_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policies for History
CREATE POLICY "History visible to everyone" ON task_history FOR SELECT USING (true);

-- Policies for Notifications
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT USING (user_id = current_setting('app.current_user', true));
CREATE POLICY "System inserts notifications" ON notifications FOR INSERT WITH CHECK (true); -- Allow anyone to trigger notif? Or rely on triggers. Let's allow insert for now from logic.
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (user_id = current_setting('app.current_user', true));

-- Trigger Update At
CREATE TRIGGER update_tasks_modtime
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
