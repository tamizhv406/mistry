import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlusCircle,
  Search,
  Filter,
  UserCheck,
  Calendar,
  Flag,
  Trash2,
  Edit2,
  CheckSquare,
  Milestone as MilestoneIcon,
  Layers,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import type { TaskRecord, MilestoneRecord, LabourWorker, TaskPriority, TaskStatus, MilestoneStatus } from '../../db/types';

interface TasksTabProps {
  siteId: string;
  workers: LabourWorker[];
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({ siteId, workers, onNotify }) => {
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'milestones'>('tasks');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');

  // Modals state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<MilestoneRecord | null>(null);

  // Form states for Task
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('Medium');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('Pending');
  const [taskWorkerId, setTaskWorkerId] = useState('');
  const [taskMilestoneId, setTaskMilestoneId] = useState('');
  const [taskProgress, setTaskProgress] = useState(0);

  // Form states for Milestone
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDesc, setMilestoneDesc] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [milestoneStatus, setMilestoneStatus] = useState<MilestoneStatus>('Pending');

  // Live queries
  const tasks = useLiveQuery(
    () => db.tasks.filter(t => t.siteId === siteId && !t.isDeleted).toArray(),
    [siteId]
  ) || [];

  const milestones = useLiveQuery(
    () => db.milestones.filter(m => m.siteId === siteId && !m.isDeleted).toArray(),
    [siteId]
  ) || [];

  const milestoneMap = new Map(milestones.map(m => [m.id, m.title]));
  const workerMap = new Map(workers.map(w => [w.id, w.name]));

  // Open Task modal
  const openTaskModal = (task?: TaskRecord) => {
    if (task) {
      setEditingTask(task);
      setTaskTitle(task.title);
      setTaskDesc(task.description || '');
      setTaskDueDate(task.dueDate);
      setTaskPriority(task.priority);
      setTaskStatus(task.status);
      setTaskWorkerId(task.assignedWorkerId || '');
      setTaskMilestoneId(task.milestoneId || '');
      setTaskProgress(task.progressPercent || 0);
    } else {
      setEditingTask(null);
      setTaskTitle('');
      setTaskDesc('');
      setTaskDueDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
      setTaskPriority('Medium');
      setTaskStatus('Pending');
      setTaskWorkerId('');
      setTaskMilestoneId('');
      setTaskProgress(0);
    }
    setShowTaskModal(true);
  };

  // Save Task
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskDueDate) {
      onNotify?.('Task title and due date are required', 'error');
      return;
    }

    const now = new Date().toISOString();
    const assignedWorker = workers.find(w => w.id === taskWorkerId);
    const selectedMilestone = milestones.find(m => m.id === taskMilestoneId);

    const taskData: TaskRecord = {
      id: editingTask ? editingTask.id : `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: editingTask ? editingTask.userId : (db as any).currentUser?.id || 'usr-default',
      siteId,
      title: taskTitle.trim(),
      description: taskDesc.trim() || undefined,
      dueDate: taskDueDate,
      priority: taskPriority,
      status: taskStatus,
      progressPercent: Number(taskProgress) || 0,
      assignedWorkerId: taskWorkerId || undefined,
      assignedWorkerName: assignedWorker ? assignedWorker.name : undefined,
      milestoneId: taskMilestoneId || undefined,
      milestoneName: selectedMilestone ? selectedMilestone.title : undefined,
      isDeleted: false,
      createdAt: editingTask ? editingTask.createdAt : now,
      updatedAt: now,
    };

    await db.tasks.put(taskData);
    setShowTaskModal(false);
    onNotify?.(editingTask ? 'Task updated successfully' : 'Task created successfully', 'success');
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      const now = new Date().toISOString();
      await db.tasks.update(taskId, { isDeleted: true, deletedAt: now, updatedAt: now });
      onNotify?.('Task moved to trash', 'info');
    }
  };

  // Toggle quick complete
  const handleToggleComplete = async (task: TaskRecord) => {
    const newStatus: TaskStatus = task.status === 'Completed' ? 'In Progress' : 'Completed';
    const newProgress = newStatus === 'Completed' ? 100 : task.progressPercent === 100 ? 50 : task.progressPercent;
    const now = new Date().toISOString();
    await db.tasks.update(task.id, {
      status: newStatus,
      progressPercent: newProgress,
      updatedAt: now,
    });
    onNotify?.(`Task marked as ${newStatus}`, 'success');
  };

  // Open Milestone Modal
  const openMilestoneModal = (milestone?: MilestoneRecord) => {
    if (milestone) {
      setEditingMilestone(milestone);
      setMilestoneTitle(milestone.title);
      setMilestoneDesc(milestone.description || '');
      setMilestoneDate(milestone.targetDate);
      setMilestoneStatus(milestone.status);
    } else {
      setEditingMilestone(null);
      setMilestoneTitle('');
      setMilestoneDesc('');
      setMilestoneDate(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
      setMilestoneStatus('Pending');
    }
    setShowMilestoneModal(true);
  };

  // Save Milestone
  const handleSaveMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneTitle.trim() || !milestoneDate) {
      onNotify?.('Milestone title and target date are required', 'error');
      return;
    }

    const now = new Date().toISOString();
    const milestoneData: MilestoneRecord = {
      id: editingMilestone ? editingMilestone.id : `ms-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: editingMilestone ? editingMilestone.userId : (db as any).currentUser?.id || 'usr-default',
      siteId,
      title: milestoneTitle.trim(),
      description: milestoneDesc.trim() || undefined,
      targetDate: milestoneDate,
      status: milestoneStatus,
      orderIndex: milestones.length + 1,
      isDeleted: false,
      createdAt: editingMilestone ? editingMilestone.createdAt : now,
      updatedAt: now,
    };

    await db.milestones.put(milestoneData);
    setShowMilestoneModal(false);
    onNotify?.(editingMilestone ? 'Milestone updated' : 'Milestone created', 'success');
  };

  // Delete Milestone
  const handleDeleteMilestone = async (milestoneId: string) => {
    if (window.confirm('Delete this milestone?')) {
      const now = new Date().toISOString();
      await db.milestones.update(milestoneId, { isDeleted: true, deletedAt: now, updatedAt: now });
      onNotify?.('Milestone moved to trash', 'info');
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase())) ||
      (t.assignedWorkerName && t.assignedWorkerName.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'All' || t.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const completedCount = tasks.filter(t => t.status === 'Completed').length;
  const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
  const pendingCount = tasks.filter(t => t.status === 'Pending').length;
  const overdueCount = tasks.filter(t => t.status !== 'Completed' && new Date(t.dueDate).getTime() < Date.now()).length;
  const overallTaskProgress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Overview Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Overall Progress</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E293B', marginTop: '2px' }}>{overallTaskProgress}%</div>
            <span style={{ fontSize: '0.72rem', color: '#16A34A' }}>{completedCount} of {tasks.length} tasks completed</span>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
            <TrendingUp size={22} />
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>In Progress</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563EB', marginTop: '2px' }}>{inProgressCount}</div>
            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{pendingCount} pending</span>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
            <Clock size={22} />
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Milestones</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7E22CE', marginTop: '2px' }}>{milestones.length}</div>
            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{milestones.filter(m => m.status === 'Completed').length} completed</span>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333EA' }}>
            <MilestoneIcon size={22} />
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Overdue Tasks</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: overdueCount > 0 ? '#DC2626' : '#16A34A', marginTop: '2px' }}>{overdueCount}</div>
            <span style={{ fontSize: '0.72rem', color: overdueCount > 0 ? '#DC2626' : '#16A34A' }}>
              {overdueCount > 0 ? 'Requires attention' : 'On schedule'}
            </span>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: overdueCount > 0 ? '#FEF2F2' : '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: overdueCount > 0 ? '#DC2626' : '#16A34A' }}>
            <AlertTriangle size={22} />
          </div>
        </div>
      </div>

      {/* Sub-tab navigation & action header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', background: '#F1F5F9', padding: '4px', borderRadius: '8px' }}>
          <button
            type="button"
            className={`btn-subtab ${activeSubTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('tasks')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: 'none',
              background: activeSubTab === 'tasks' ? '#FFFFFF' : 'transparent',
              color: activeSubTab === 'tasks' ? '#0F172A' : '#64748B',
              boxShadow: activeSubTab === 'tasks' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
            }}
          >
            Tasks ({tasks.length})
          </button>
          <button
            type="button"
            className={`btn-subtab ${activeSubTab === 'milestones' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('milestones')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: 'none',
              background: activeSubTab === 'milestones' ? '#FFFFFF' : 'transparent',
              color: activeSubTab === 'milestones' ? '#0F172A' : '#64748B',
              boxShadow: activeSubTab === 'milestones' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
            }}
          >
            Milestones ({milestones.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {activeSubTab === 'tasks' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openTaskModal()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <PlusCircle size={16} />
              <span>Create Task</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openMilestoneModal()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <PlusCircle size={16} />
              <span>Add Milestone</span>
            </button>
          )}
        </div>
      </div>

      {/* TASKS VIEW */}
      {activeSubTab === 'tasks' && (
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
            <div className="search-input-wrapper" style={{ flex: 1, minWidth: '240px' }}>
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search tasks by title, assignee, details..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Blocked">Blocked</option>
            </select>

            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            >
              <option value="All">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Tasks List */}
          {filteredTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748B' }}>
              <CheckSquare size={36} style={{ color: '#94A3B8', margin: '0 auto 10px' }} />
              <h4 style={{ margin: '0 0 4px', color: '#1E293B', fontSize: '1rem' }}>No tasks found</h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                {search || statusFilter !== 'All' || priorityFilter !== 'All'
                  ? 'No tasks matched your filter criteria.'
                  : 'Start adding tasks and assigning workforce to track day-to-day progress.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredTasks.map(task => {
                const isOverdue = task.status !== 'Completed' && new Date(task.dueDate).getTime() < Date.now();
                return (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      borderRadius: '10px',
                      border: `1px solid ${task.status === 'Completed' ? '#E2E8F0' : isOverdue ? '#FECACA' : '#E2E8F0'}`,
                      background: task.status === 'Completed' ? '#F8FAFC' : isOverdue ? '#FFF5F5' : '#FFFFFF',
                      gap: '14px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '260px' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(task)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: task.status === 'Completed' ? '#16A34A' : '#94A3B8',
                          padding: 0,
                        }}
                        title={task.status === 'Completed' ? 'Mark Incomplete' : 'Mark Completed'}
                      >
                        <CheckCircle2 size={22} />
                      </button>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.92rem',
                              fontWeight: 700,
                              color: task.status === 'Completed' ? '#64748B' : '#0F172A',
                              textDecoration: task.status === 'Completed' ? 'line-through' : 'none',
                            }}
                          >
                            {task.title}
                          </span>

                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background:
                                task.priority === 'Urgent' ? '#FEE2E2' :
                                task.priority === 'High' ? '#FFEDD5' :
                                task.priority === 'Medium' ? '#FEF3C7' : '#F1F5F9',
                              color:
                                task.priority === 'Urgent' ? '#DC2626' :
                                task.priority === 'High' ? '#EA580C' :
                                task.priority === 'Medium' ? '#D97706' : '#475569',
                            }}
                          >
                            {task.priority}
                          </span>

                          {task.milestoneName && (
                            <span style={{ fontSize: '0.7rem', color: '#7E22CE', background: '#F3E8FF', padding: '2px 6px', borderRadius: '4px' }}>
                              🏁 {task.milestoneName}
                            </span>
                          )}
                        </div>

                        {task.description && (
                          <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748B' }}>
                            {task.description}
                          </p>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.74rem', color: '#64748B' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={13} />
                            Due: <strong style={{ color: isOverdue ? '#DC2626' : '#334155' }}>{task.dueDate}</strong>
                          </span>
                          {task.assignedWorkerName && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <UserCheck size={13} />
                              Assigned: <strong style={{ color: '#0F172A' }}>{task.assignedWorkerName}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress & Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '100px', textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                          {task.progressPercent}%
                        </div>
                        <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${task.progressPercent}%`,
                              height: '100%',
                              background: task.status === 'Completed' ? '#16A34A' : '#2563EB',
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => openTaskModal(task)}
                          style={{ padding: '6px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', color: '#475569' }}
                          title="Edit task"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleDeleteTask(task.id)}
                          style={{ padding: '6px', borderRadius: '6px', border: '1px solid #FCA5A5', background: '#FEF2F2', cursor: 'pointer', color: '#DC2626' }}
                          title="Delete task"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MILESTONES VIEW */}
      {activeSubTab === 'milestones' && (
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
          {milestones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748B' }}>
              <MilestoneIcon size={36} style={{ color: '#94A3B8', margin: '0 auto 10px' }} />
              <h4 style={{ margin: '0 0 4px', color: '#1E293B', fontSize: '1rem' }}>No milestones created yet</h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                Set up major construction stages (e.g. Foundation, Plinth Beam, Roof Slab, Brickwork, Plastering, Handover).
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {milestones.map((ms, idx) => (
                <div
                  key={ms.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    background: ms.status === 'Completed' ? '#F0FDF4' : '#FFFFFF',
                    gap: '14px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: ms.status === 'Completed' ? '#16A34A' : '#EFF6FF',
                        color: ms.status === 'Completed' ? '#FFFFFF' : '#2563EB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                      }}
                    >
                      {idx + 1}
                    </div>

                    <div>
                      <strong style={{ fontSize: '0.95rem', color: '#0F172A', display: 'block' }}>
                        {ms.title}
                      </strong>
                      {ms.description && (
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748B' }}>
                          {ms.description}
                        </p>
                      )}
                      <span style={{ fontSize: '0.74rem', color: '#64748B', display: 'block', marginTop: '4px' }}>
                        Target Completion: <strong>{ms.targetDate}</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: ms.status === 'Completed' ? '#DCFCE7' : ms.status === 'In Progress' ? '#EFF6FF' : '#FEF3C7',
                        color: ms.status === 'Completed' ? '#16A34A' : ms.status === 'In Progress' ? '#2563EB' : '#D97706',
                      }}
                    >
                      {ms.status}
                    </span>

                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => openMilestoneModal(ms)}
                      style={{ padding: '6px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', color: '#475569' }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => handleDeleteMilestone(ms.id)}
                      style={{ padding: '6px', borderRadius: '6px', border: '1px solid #FCA5A5', background: '#FEF2F2', cursor: 'pointer', color: '#DC2626' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT TASK MODAL */}
      {showTaskModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 800 }}>
              {editingTask ? 'Edit Task' : 'Create New Construction Task'}
            </h3>

            <form onSubmit={handleSaveTask} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Column reinforcement tying, curing roof slab..."
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Description / Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Specific instructions for supervisor or workers..."
                  value={taskDesc}
                  onChange={e => setTaskDesc(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Due Date *</label>
                  <input
                    type="date"
                    required
                    value={taskDueDate}
                    onChange={e => setTaskDueDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Priority</label>
                  <select
                    value={taskPriority}
                    onChange={e => setTaskPriority(e.target.value as TaskPriority)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Status</label>
                  <select
                    value={taskStatus}
                    onChange={e => setTaskStatus(e.target.value as TaskStatus)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Progress ({taskProgress}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={taskProgress}
                    onChange={e => setTaskProgress(Number(e.target.value))}
                    style={{ width: '100%', marginTop: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Assign Worker</label>
                  <select
                    value={taskWorkerId}
                    onChange={e => setTaskWorkerId(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  >
                    <option value="">Unassigned</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.category})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Link Milestone</label>
                  <select
                    value={taskMilestoneId}
                    onChange={e => setTaskMilestoneId(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  >
                    <option value="">None</option>
                    {milestones.map(m => (
                      <option key={m.id} value={m.id}>{m.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowTaskModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MILESTONE MODAL */}
      {showMilestoneModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 800 }}>
              {editingMilestone ? 'Edit Milestone' : 'Add Project Milestone'}
            </h3>

            <form onSubmit={handleSaveMilestone} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Milestone Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ground Floor Roof Slab Casting"
                  value={milestoneTitle}
                  onChange={e => setMilestoneTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Target Date *</label>
                <input
                  type="date"
                  required
                  value={milestoneDate}
                  onChange={e => setMilestoneDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Status</label>
                <select
                  value={milestoneStatus}
                  onChange={e => setMilestoneStatus(e.target.value as MilestoneStatus)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowMilestoneModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingMilestone ? 'Save Milestone' : 'Create Milestone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
