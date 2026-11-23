import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Network,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Undo2,
  Redo2,
  Plus,
  Save,
  CheckCircle2,
  Circle,
  Clock,
  User,
  Target,
  Sparkles,
  Calendar,
  AlertTriangle,
  Layers,
  Search,
  Filter,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  Eye,
  X,
  FileText,
  ExternalLink,
  Trash2,
  Copy,
  Edit2,
  MapPin,
  Compass,
  Navigation,
  Move
} from 'lucide-react';
import { api } from '../api';
import { Button, Badge, Drawer, useToast, ConfirmDialog, Modal } from '../components/ui';

// Priority Colors: NO red! Red is strictly reserved for Overdue (Amendment 7)
const PRIORITY_THEME = {
  now: { label: 'Now', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.4)' }, // Gold
  next: { label: 'Next', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.4)' }, // Sky
  later: { label: 'Later', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.4)' } // Slate
};

export default function MindmapEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [mindmap, setMindmap] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [hierarchy, setHierarchy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved'

  // Layout & Canvas state
  const [layoutMode, setLayoutMode] = useState('radial'); // 'radial' | 'horizontal'
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);

  const canvasRef = useRef(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panStateRef = useRef({ x: 0, y: 0 });
  panStateRef.current = pan;

  // Focus & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [focusedBranchId, setFocusedBranchId] = useState(null);
  const [showLegend, setShowLegend] = useState(false);

  // Selection & Drawer states
  const [selectedNode, setSelectedNode] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Undo / Redo history stacks (last 30 actions - Amendment 9)
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Confirm dialogs
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, nodeId: null, count: 1 });
  const [completeDescendantsConfirm, setCompleteDescendantsConfirm] = useState({ open: false, nodeId: null, count: 0 });

  // Notes state for selected node
  const [nodeNotes, setNodeNotes] = useState([]);
  const [newNoteBody, setNewNoteBody] = useState('');
  const [creatingNote, setCreatingNote] = useState(false);

  // Responsive listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fit to screen calculation
  const handleFitToScreen = useCallback((targetNodes = null) => {
    const list = targetNodes || nodes;
    if (!canvasRef.current || list.length === 0) {
      setPan({ x: 0, y: 0 });
      setZoom(1);
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const viewportW = rect.width || window.innerWidth - 260;
    const viewportH = rect.height || window.innerHeight - 120;

    let minX = -130;
    let maxX = 130;
    let minY = -60;
    let maxY = 60;

    list.forEach((n) => {
      const nx = n.x || 0;
      const ny = n.y || 0;
      minX = Math.min(minX, nx - 120);
      maxX = Math.max(maxX, nx + 120);
      minY = Math.min(minY, ny - 50);
      maxY = Math.max(maxY, ny + 50);
    });

    const contentW = Math.max(300, maxX - minX + 160);
    const contentH = Math.max(200, maxY - minY + 160);

    const scaleX = viewportW / contentW;
    const scaleY = viewportH / contentH;
    const autoZoom = Math.min(1.05, Math.max(0.3, Math.min(scaleX, scaleY)));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const roundedZoom = +autoZoom.toFixed(2);
    setZoom(roundedZoom);
    setPan({
      x: Math.round(-centerX * roundedZoom),
      y: Math.round(-centerY * roundedZoom)
    });
  }, [nodes]);

  // Load mindmap data
  const loadMindmap = useCallback(async (autoFit = false) => {
    try {
      setLoading(true);
      const res = await api.getMindmap(id);
      setMindmap(res.mindmap);
      setNodes(res.nodes || []);
      setHierarchy(res.hierarchy || []);
      setLayoutMode(res.mindmap.layoutPref || 'radial');

      if (autoFit || nodes.length === 0) {
        setTimeout(() => handleFitToScreen(res.nodes), 60);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load mindmap');
    } finally {
      setLoading(false);
    }
  }, [id, toast, handleFitToScreen, nodes.length]);

  useEffect(() => {
    loadMindmap(true);
  }, [id]);

  // Deep Link Handling: Check URL hash (e.g. #node-12)
  useEffect(() => {
    if (!loading && location.hash && nodes.length > 0) {
      const match = location.hash.match(/^#node-(\d+)$/);
      if (match) {
        const targetId = parseInt(match[1], 10);
        const target = nodes.find((n) => n.id === targetId);
        if (target) {
          setSelectedNode(target);
          if (target.x !== undefined && target.y !== undefined) {
            setPan({
              x: Math.round(-target.x * zoom),
              y: Math.round(-target.y * zoom)
            });
          }
        }
      }
    }
  }, [loading, location.hash, nodes, zoom]);

  // Load notes when a node is selected in drawer
  useEffect(() => {
    if (selectedNode) {
      api.getNotes({ ownerType: 'mindmap_node', ownerId: String(selectedNode.id) })
        .then((res) => setNodeNotes(res.notes || []))
        .catch(() => setNodeNotes([]));
    } else {
      setNodeNotes([]);
    }
  }, [selectedNode]);

  // Non-passive wheel listener for smooth pan & zoom
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const handleWheel = (e) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Zoom centered on cursor position
        const rect = canvasEl.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;

        setZoom((prevZoom) => {
          const newZoom = Math.min(2.5, Math.max(0.25, +(prevZoom * zoomFactor).toFixed(3)));
          setPan((prevPan) => ({
            x: Math.round(mouseX - (mouseX - prevPan.x) * (newZoom / prevZoom)),
            y: Math.round(mouseY - (mouseY - prevPan.y) * (newZoom / prevZoom))
          }));
          return newZoom;
        });
      } else {
        // Pan in X and Y (supporting 2-finger trackpad, horizontal wheel, or standard wheel)
        const deltaX = e.shiftKey ? e.deltaY : e.deltaX;
        const deltaY = e.shiftKey ? 0 : e.deltaY;
        setPan((prev) => ({
          x: prev.x - deltaX,
          y: prev.y - deltaY
        }));
      }
    };

    canvasEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvasEl.removeEventListener('wheel', handleWheel);
  }, []);

  // Global window listeners for butter-smooth panning (never drops cursor)
  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      if (!isPanningRef.current) return;
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      });
    };

    const handleWindowMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setIsPanning(false);
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, []);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }

      if (e.code === 'Space') {
        setSpacePressed(true);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom((z) => Math.max(0.25, +(z - 0.15).toFixed(2)));
      } else if (e.key === '0') {
        e.preventDefault();
        handleFitToScreen();
      } else if (e.key === 'ArrowUp') {
        setPan((p) => ({ ...p, y: p.y + 50 }));
      } else if (e.key === 'ArrowDown') {
        setPan((p) => ({ ...p, y: p.y - 50 }));
      } else if (e.key === 'ArrowLeft') {
        setPan((p) => ({ ...p, x: p.x + 50 }));
      } else if (e.key === 'ArrowRight') {
        setPan((p) => ({ ...p, x: p.x - 50 }));
      } else if (e.key === 'Escape') {
        setSelectedNode(null);
        setShowLegend(false);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleFitToScreen]);

  // Push state to Undo Stack
  const pushUndoState = (prevNodes) => {
    setUndoStack((prev) => [...prev.slice(-29), prevNodes]);
    setRedoStack([]); // Clear redo stack on new action
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev.slice(-29), nodes]);
    setUndoStack((prev) => prev.slice(0, -1));
    setNodes(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev.slice(-29), nodes]);
    setRedoStack((prev) => prev.slice(0, -1));
    setNodes(nextState);
  };

  // Node Mutation Helpers
  const handleUpdateNode = async (nodeId, updates) => {
    const current = nodes.find((n) => n.id === nodeId);
    if (!current) return;

    pushUndoState(nodes);
    setSaveStatus('saving');

    // Optimistic update
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)));
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) => ({ ...prev, ...updates }));
    }

    try {
      const res = await api.updateMindmapNode(id, nodeId, {
        ...updates,
        expectedUpdatedAt: current.updatedAt // Last-Write-Wins Protection
      });
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, ...res.node } : n)));
      if (selectedNode?.id === nodeId) {
        setSelectedNode(res.node);
      }
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('unsaved');
      toast.error(err.message || 'Failed to update node. Reverting changes.');
      handleUndo();
    }
  };

  // Quick Status Toggle (Todo -> Doing -> Done -> Todo)
  const handleToggleStatus = (e, node) => {
    e.stopPropagation();
    const nextStatus = node.status === 'todo' ? 'doing' : node.status === 'doing' ? 'done' : 'todo';
    handleUpdateNode(node.id, { status: nextStatus });
  };

  // Add Child Node
  const handleAddChild = async (parentId) => {
    try {
      setSaveStatus('saving');
      const res = await api.createMindmapNode(id, {
        parentId: parentId || null,
        title: 'New Action Item',
        priority: 'now',
        status: 'todo'
      });
      toast.success('New action node added');
      loadMindmap(false);
      setSelectedNode(res.node);
    } catch (err) {
      toast.error(err.message || 'Failed to add node');
    } finally {
      setSaveStatus('saved');
    }
  };

  // Switch layout mode (Radial <-> Horizontal) with auto-centering
  const handleSwitchLayout = async (mode) => {
    if (mode === layoutMode) return;
    setLayoutMode(mode);
    try {
      await api.updateMindmap(id, { layoutPref: mode });
      const res = await api.getMindmap(id);
      setNodes(res.nodes || []);
      setHierarchy(res.hierarchy || []);
      setTimeout(() => handleFitToScreen(res.nodes), 60);
      toast.info(`Switched to ${mode === 'radial' ? 'Radial (Sunburst)' : 'Horizontal (Tree)'} view`);
    } catch (err) {
      toast.error('Failed to change layout preference');
    }
  };

  // Create Task from Node (Idempotent single source of truth - Amendment 4)
  const handleCreateTaskFromNode = async (node) => {
    try {
      const res = await api.createTaskFromNode(id, node.id);
      if (res.alreadyExisted) {
        toast.info(`Already linked to Task: "${res.task.title}"`);
      } else {
        toast.success(`Task created in Command Center: "${res.task.title}"`);
      }
      handleUpdateNode(node.id, { linkedTaskId: res.task.id });
      loadMindmap(false);
    } catch (err) {
      toast.error(err.message || 'Failed to create task from node');
    }
  };

  // Complete All Descendants (Amendment 6)
  const handleCompleteAllDescendants = async (nodeId) => {
    try {
      const res = await api.completeAllDescendants(id, nodeId);
      toast.success(`Completed ${res.completedCount} actions in this track!`);
      setCompleteDescendantsConfirm({ open: false, nodeId: null, count: 0 });
      loadMindmap(false);
    } catch (err) {
      toast.error(err.message || 'Failed to complete actions');
    }
  };

  // Delete Subtree
  const handleDeleteSubtree = async () => {
    try {
      const res = await api.deleteMindmapNode(id, deleteConfirm.nodeId);
      toast.success(`Deleted ${res.deletedCount} node${res.deletedCount > 1 ? 's' : ''}`);
      setDeleteConfirm({ open: false, nodeId: null, count: 1 });
      if (selectedNode?.id === deleteConfirm.nodeId) setSelectedNode(null);
      loadMindmap(false);
    } catch (err) {
      toast.error(err.message || 'Failed to delete node');
    }
  };

  // Add Note to Node
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteBody.trim() || !selectedNode) return;

    try {
      setCreatingNote(true);
      const res = await api.createNote({
        ownerType: 'mindmap_node',
        ownerId: String(selectedNode.id),
        title: `Note: ${selectedNode.title}`,
        body: newNoteBody.trim()
      });
      setNodeNotes((prev) => [res.note, ...prev]);
      setNewNoteBody('');
      toast.success('Note added to action node');
    } catch (err) {
      toast.error(err.message || 'Failed to add note');
    } finally {
      setCreatingNote(false);
    }
  };

  // Export handlers
  const handleExportMarkdown = async () => {
    try {
      window.open(`/api/mindmaps/${id}/export?format=markdown`, '_blank');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const handleExportJson = async () => {
    try {
      window.open(`/api/mindmaps/${id}/export?format=json`, '_blank');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  // Pan and Zoom Canvas Handlers
  const handleMouseDown = (e) => {
    // If interacting with inputs/buttons, don't start canvas pan
    if (e.target.closest('input') || e.target.closest('textarea') || e.target.closest('select') || e.target.closest('button')) {
      return;
    }

    // Spacebar held, middle click, or clicking canvas background
    if (spacePressed || e.button === 1 || !e.target.closest('.mindmap-node-card')) {
      e.preventDefault();
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  // Filtered Nodes Calculation
  const visibleNodes = useMemo(() => {
    return nodes.filter((n) => {
      // Focus mode check
      if (focusedBranchId && n.id !== focusedBranchId && n.parentId !== focusedBranchId) {
        return false;
      }
      // Priority filter
      if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false;
      // Status filter
      if (statusFilter !== 'all' && n.status !== statusFilter) return false;
      // Overdue filter
      if (overdueOnly && !n.isOverdue) return false;
      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          (n.summary && n.summary.toLowerCase().includes(q)) ||
          (n.why && n.why.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [nodes, focusedBranchId, priorityFilter, statusFilter, overdueOnly, searchTerm]);

  // Minimap bounds calculation
  const minimapData = useMemo(() => {
    if (nodes.length === 0) return null;
    let minX = -130;
    let maxX = 130;
    let minY = -60;
    let maxY = 60;

    nodes.forEach((n) => {
      const nx = n.x || 0;
      const ny = n.y || 0;
      minX = Math.min(minX, nx - 120);
      maxX = Math.max(maxX, nx + 120);
      minY = Math.min(minY, ny - 50);
      maxY = Math.max(maxY, ny + 50);
    });

    const w = Math.max(400, maxX - minX + 160);
    const h = Math.max(300, maxY - minY + 160);
    return { minX, maxX, minY, maxY, w, h };
  }, [nodes]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div style={{ textAlign: 'center' }}>
          <Network size={40} className="animate-spin" style={{ color: 'var(--gold-primary)', margin: '0 auto 16px auto' }} />
          <div style={{ fontSize: '16px', fontWeight: 600 }}>Loading Strategic Mindmap Studio...</div>
        </div>
      </div>
    );
  }

  if (!mindmap) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Mindmap not found</h2>
          <Button onClick={() => navigate('/mindmaps')}>Back to Mindmaps</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--bg-app)'
      }}
    >
      {/* Top Studio Control Bar - Clean, non-wrapping toolbar */}
      <div
        style={{
          height: '56px',
          flexShrink: 0,
          padding: '0 20px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          zIndex: 20,
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}
      >
        {/* Left: Back Arrow, Title, Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button
            onClick={() => navigate('/mindmaps')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '6px',
              borderRadius: '6px'
            }}
            title="Back to all mindmaps"
          >
            <ArrowLeft size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'Outfit, sans-serif' }}>
              {mindmap.title}
            </span>
            <Badge variant="outline" style={{ fontSize: '11px' }}>
              {mindmap.targetValue ? `${mindmap.targetValue} ${mindmap.targetUnit || ''}` : 'Goal Map'}
            </Badge>
            <Badge variant={mindmap.overallProgressPct === 100 ? 'success' : 'warning'} style={{ fontSize: '11px' }}>
              {mindmap.overallProgressPct || 0}% Done
            </Badge>
            {saveStatus === 'saving' && (
              <span style={{ fontSize: '11px', color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} className="animate-spin" /> Saving...
              </span>
            )}
          </div>
        </div>

        {/* Center: Search & Quick Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px', maxWidth: '380px', flex: '1 1 auto' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder="Search actions, KPIs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 26px 6px 30px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: 'var(--text-main)',
                fontSize: '12px'
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            onClick={() => setOverdueOnly((prev) => !prev)}
            style={{
              padding: '5px 10px',
              borderRadius: '8px',
              border: overdueOnly ? '1px solid var(--danger-border)' : '1px solid var(--border-subtle)',
              background: overdueOnly ? 'var(--danger-bg)' : 'var(--bg-surface-elevated)',
              color: overdueOnly ? 'var(--danger-text)' : 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            title="Filter overdue actions only"
          >
            Overdue
          </button>
        </div>

        {/* Right: Layout Switcher, Undo/Redo & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Segmented Layout Switcher */}
          {!isMobile && (
            <div style={{ display: 'flex', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '2px' }}>
              <button
                onClick={() => handleSwitchLayout('radial')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: layoutMode === 'radial' ? 'var(--gold-primary)' : 'transparent',
                  color: layoutMode === 'radial' ? '#090D16' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Radial
              </button>
              <button
                onClick={() => handleSwitchLayout('horizontal')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: layoutMode === 'horizontal' ? 'var(--gold-primary)' : 'transparent',
                  color: layoutMode === 'horizontal' ? '#090D16' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Horizontal
              </button>
            </div>
          )}

          {/* Undo / Redo */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px',
              color: undoStack.length > 0 ? 'var(--text-main)' : 'var(--text-dim)',
              cursor: undoStack.length > 0 ? 'pointer' : 'not-allowed'
            }}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px',
              color: redoStack.length > 0 ? 'var(--text-main)' : 'var(--text-dim)',
              cursor: redoStack.length > 0 ? 'pointer' : 'not-allowed'
            }}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={14} />
          </button>

          {/* Fit to View button */}
          <button
            onClick={() => handleFitToScreen()}
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px 10px',
              color: 'var(--text-main)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Fit All Nodes in View (Shortcut: 0)"
          >
            <Maximize2 size={13} /> Fit View
          </button>

          {/* Legend toggle */}
          <button
            onClick={() => setShowLegend((prev) => !prev)}
            style={{
              background: showLegend ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-surface-elevated)',
              border: showLegend ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px 10px',
              color: showLegend ? 'var(--gold-primary)' : 'var(--text-muted)',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Legend
          </button>

          {/* Export Buttons */}
          <Button variant="outline" size="xs" onClick={handleExportMarkdown} title="Export Markdown Outline">
            <Download size={12} style={{ marginRight: '3px' }} /> MD
          </Button>

          <Button variant="outline" size="xs" onClick={handleExportJson} title="Export Clean JSON">
            JSON
          </Button>

          <Button variant="outline" size="xs" onClick={() => window.print()} title="Print Strategy Blueprint">
            <Printer size={12} />
          </Button>

          <Button variant="primary" size="xs" onClick={() => handleAddChild(null)}>
            <Plus size={13} style={{ marginRight: '3px' }} /> Add Track
          </Button>
        </div>
      </div>

      {/* Main Canvas / Workspace Area */}
      <div
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: isMobile ? 'auto' : 'hidden',
          cursor: spacePressed ? 'grab' : isPanning ? 'grabbing' : 'default',
          background: 'radial-gradient(circle at center, #121A2D 0%, #090D16 100%)',
          userSelect: isPanning ? 'none' : 'auto'
        }}
      >
        {/* Floating Zoom & Canvas Controls (Desktop only) */}
        {!isMobile && (
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(18, 26, 45, 0.95)',
              border: '1px solid var(--border-subtle)',
              backdropFilter: 'blur(8px)',
              borderRadius: '10px',
              padding: '6px 10px',
              boxShadow: 'var(--shadow-card)'
            }}
          >
            <button
              onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}
              style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '4px' }}
              title="Zoom In (+)"
            >
              <ZoomIn size={16} />
            </button>

            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--gold-primary)',
                padding: '0 4px',
                minWidth: '44px',
                textAlign: 'center',
                cursor: 'pointer'
              }}
              title="Click to reset to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>

            <button
              onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.15).toFixed(2)))}
              style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '4px' }}
              title="Zoom Out (-)"
            >
              <ZoomOut size={16} />
            </button>

            <span style={{ color: 'var(--border-subtle)' }}>|</span>

            <button
              onClick={() => handleFitToScreen()}
              style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '4px' }}
              title="Fit to All Nodes (0)"
            >
              <Maximize2 size={15} />
            </button>

            <button
              onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '4px' }}
              title="Center on Central Goal"
            >
              <Target size={15} />
            </button>

            <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: '6px' }}>
              Wheel to scroll • Ctrl+Wheel to zoom • Space+Drag
            </span>
          </div>
        )}

        {/* Mini-Map / Radar View (Bottom Right) */}
        {!isMobile && minimapData && showMinimap && (
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              zIndex: 30,
              width: '180px',
              height: '110px',
              background: 'rgba(18, 26, 45, 0.95)',
              border: '1px solid var(--border-subtle)',
              backdropFilter: 'blur(8px)',
              borderRadius: '10px',
              boxShadow: 'var(--shadow-card)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Mini-map header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Radar View</span>
              <button
                onClick={() => setShowMinimap(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
                title="Hide mini-map"
              >
                <X size={10} />
              </button>
            </div>

            {/* Mini-map canvas */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = (e.clientX - rect.left) / rect.width;
                const clickY = (e.clientY - rect.top) / rect.height;
                const targetWorldX = minimapData.minX + clickX * minimapData.w;
                const targetWorldY = minimapData.minY + clickY * minimapData.h;
                setPan({
                  x: Math.round(-targetWorldX * zoom),
                  y: Math.round(-targetWorldY * zoom)
                });
              }}
              style={{ flex: 1, position: 'relative', cursor: 'crosshair' }}
            >
              {/* Central Goal dot */}
              <div
                style={{
                  position: 'absolute',
                  left: `${((0 - minimapData.minX) / minimapData.w) * 100}%`,
                  top: `${((0 - minimapData.minY) / minimapData.h) * 100}%`,
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--gold-primary)',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 6px var(--gold-primary)'
                }}
              />

              {/* Node dots */}
              {visibleNodes.map((n) => {
                const prio = PRIORITY_THEME[n.priority] || PRIORITY_THEME.now;
                const pctX = (((n.x || 0) - minimapData.minX) / minimapData.w) * 100;
                const pctY = (((n.y || 0) - minimapData.minY) / minimapData.h) * 100;

                return (
                  <div
                    key={n.id}
                    style={{
                      position: 'absolute',
                      left: `${pctX}%`,
                      top: `${pctY}%`,
                      width: '4px',
                      height: '4px',
                      borderRadius: '1px',
                      background: n.isOverdue ? '#EF4444' : prio.color,
                      transform: 'translate(-50%, -50%)',
                      opacity: n.status === 'done' ? 0.4 : 0.9
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Legend Modal / Drawer (Amendment 7) */}
        {showLegend && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '20px',
              zIndex: 40,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '16px 20px',
              width: '280px',
              boxShadow: 'var(--shadow-card)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'Outfit, sans-serif' }}>
                Priority & Status Legend
              </span>
              <button onClick={() => setShowLegend(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#F59E0B' }} />
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Now Priority (Gold)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#38BDF8' }} />
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Next Priority (Sky)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#94A3B8' }} />
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Later Priority (Slate)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#EF4444' }} />
                <span style={{ color: 'var(--danger-text)', fontWeight: 600 }}>Overdue Flag (Red only!)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                <CheckCircle2 size={14} style={{ color: 'var(--success-text)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Status Done</span>
              </div>
            </div>
          </div>
        )}

        {/* Desktop / Tablet Canvas with SVG connectors */}
        {!isMobile ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: 0,
              height: 0,
              transition: isPanning ? 'none' : 'transform 0.08s ease-out',
              pointerEvents: 'auto'
            }}
          >
            {/* SVG Connectors (Woven thread / yarn curves) */}
            <svg
              style={{
                position: 'absolute',
                left: '-10000px',
                top: '-10000px',
                width: '20000px',
                height: '20000px',
                pointerEvents: 'none',
                overflow: 'visible'
              }}
            >
              <defs>
                <linearGradient id="threadGradientGold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#D97706" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="threadGradientSky" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#0284C7" stopOpacity="0.4" />
                </linearGradient>
              </defs>

              {/* Draw connectors between parent and children */}
              {visibleNodes.map((node) => {
                let parentX = 0;
                let parentY = 0;

                if (node.parentId) {
                  const p = nodes.find((n) => n.id === node.parentId);
                  if (p) {
                    parentX = p.x || 0;
                    parentY = p.y || 0;
                  }
                }

                const startX = parentX + 10000;
                const startY = parentY + 10000;
                const endX = (node.x || 0) + 10000;
                const endY = (node.y || 0) + 10000;

                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2;

                const pathData = layoutMode === 'horizontal'
                  ? `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`
                  : `M ${startX} ${startY} Q ${midX} ${startY}, ${endX} ${endY}`;

                return (
                  <path
                    key={`conn_${node.id}`}
                    d={pathData}
                    fill="none"
                    stroke={node.priority === 'now' ? 'url(#threadGradientGold)' : 'rgba(255, 255, 255, 0.16)'}
                    strokeWidth={node.parentId ? 2 : 3}
                    strokeDasharray={node.status === 'done' ? 'none' : '4, 4'}
                    opacity={node.status === 'done' ? 0.9 : 0.6}
                  />
                );
              })}
            </svg>

            {/* Central Goal Node (Visual Anchor at 0, 0) */}
            <div
              style={{
                position: 'absolute',
                left: '-130px',
                top: '-60px',
                width: '260px',
                padding: '16px 20px',
                background: 'linear-gradient(135deg, #18223B 0%, #121A2D 100%)',
                border: '2px solid var(--gold-primary)',
                borderRadius: '16px',
                boxShadow: '0 0 35px rgba(245, 158, 11, 0.3)',
                color: 'var(--text-heading)',
                textAlign: 'center',
                zIndex: 10,
                userSelect: 'none'
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--gold-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                CENTRAL BUSINESS GOAL
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                {mindmap.title}
              </div>
              {mindmap.targetValue && (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Target: <strong style={{ color: 'var(--gold-primary)' }}>{mindmap.targetValue} {mindmap.targetUnit || ''}</strong>
                </div>
              )}
            </div>

            {/* Render Visual Positioned Nodes */}
            {visibleNodes.map((node) => {
              const prioTheme = PRIORITY_THEME[node.priority] || PRIORITY_THEME.now;
              const isSelected = selectedNode?.id === node.id;
              const isEditing = editingNodeId === node.id;

              const left = (node.x || 0) - 110;
              const top = (node.y || 0) - 40;

              return (
                <div
                  key={node.id}
                  id={`node-${node.id}`}
                  className="mindmap-node-card"
                  onClick={() => setSelectedNode(node)}
                  style={{
                    position: 'absolute',
                    left: `${left}px`,
                    top: `${top}px`,
                    width: '220px',
                    minHeight: '80px',
                    background: node.isOverdue ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-surface-elevated)',
                    border: node.isOverdue
                      ? '1px solid var(--danger-border)'
                      : isSelected
                      ? '2px solid var(--gold-primary)'
                      : '1px solid var(--border-subtle)',
                    borderLeft: `4px solid ${node.isOverdue ? '#EF4444' : prioTheme.color}`,
                    borderRadius: '10px',
                    padding: '10px 12px',
                    boxShadow: isSelected ? 'var(--shadow-glow)' : 'var(--shadow-card)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '6px',
                    transition: 'border 0.15s ease, box-shadow 0.15s ease',
                    zIndex: isSelected ? 15 : 5
                  }}
                >
                  {/* Top Bar with Status Icon & Priority Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button
                      onClick={(e) => handleToggleStatus(e, node)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: node.status === 'done' ? 'var(--success-text)' : 'var(--text-dim)' }}
                      title={`Status: ${node.status} (Click to toggle)`}
                    >
                      {node.status === 'done' ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {node.isOverdue && (
                        <span style={{ fontSize: '10px', color: 'var(--danger-text)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <AlertTriangle size={11} /> OVERDUE
                        </span>
                      )}
                      <span style={{ fontSize: '10px', fontWeight: 700, color: prioTheme.color, textTransform: 'uppercase' }}>
                        {prioTheme.label}
                      </span>
                    </div>
                  </div>

                  {/* Title (Inline editable or static) */}
                  {isEditing ? (
                    <input
                      type="text"
                      value={inlineTitle}
                      autoFocus
                      onChange={(e) => setInlineTitle(e.target.value)}
                      onBlur={() => {
                        handleUpdateNode(node.id, { title: inlineTitle.trim() || node.title });
                        setEditingNodeId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateNode(node.id, { title: inlineTitle.trim() || node.title });
                          setEditingNodeId(null);
                        }
                      }}
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: 'var(--text-main)',
                        fontSize: '13px',
                        padding: '2px 4px'
                      }}
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingNodeId(node.id);
                        setInlineTitle(node.title);
                      }}
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: node.status === 'done' ? 'var(--text-muted)' : 'var(--text-heading)',
                        textDecoration: node.status === 'done' ? 'line-through' : 'none',
                        lineHeight: '1.3'
                      }}
                    >
                      {node.title}
                    </div>
                  )}

                  {/* Footer Bar: KPI & Action Add Child */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <span>
                      {node.owner || (node.dueDate ? new Date(node.dueDate).toISOString().slice(5, 10) : 'Action')}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddChild(node.id);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        borderRadius: '4px'
                      }}
                      title="Add child action under this node"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Mobile Tap-Friendly Vertical Tree / Accordion View */
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '14px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--gold-primary)', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--gold-primary)', fontWeight: 700, textTransform: 'uppercase' }}>CENTRAL GOAL</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>{mindmap.title}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Overall: <strong>{mindmap.overallProgressPct || 0}% Complete</strong>
              </div>
            </div>

            {visibleNodes.map((node) => {
              const prioTheme = PRIORITY_THEME[node.priority] || PRIORITY_THEME.now;

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  style={{
                    minHeight: '48px',
                    padding: '12px 14px',
                    background: node.isOverdue ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-surface)',
                    border: `1px solid ${node.isOverdue ? 'var(--danger-border)' : 'var(--border-subtle)'}`,
                    borderLeft: `4px solid ${node.isOverdue ? '#EF4444' : prioTheme.color}`,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={(e) => handleToggleStatus(e, node)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: node.status === 'done' ? 'var(--success-text)' : 'var(--text-dim)' }}
                    >
                      {node.status === 'done' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-heading)', textDecoration: node.status === 'done' ? 'line-through' : 'none' }}>
                        {node.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                        {prioTheme.label} • {node.owner || 'Founder'}
                      </div>
                    </div>
                  </div>

                  <ChevronRight size={16} style={{ color: 'var(--text-dim)' }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Node Detail Drawer / Mobile Bottom Sheet */}
      {selectedNode && (
        <Drawer
          isOpen={Boolean(selectedNode)}
          onClose={() => setSelectedNode(null)}
          title="Action Node Details"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Title & Status */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <button
                  onClick={(e) => handleToggleStatus(e, selectedNode)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: selectedNode.status === 'done' ? 'var(--success-text)' : 'var(--text-dim)' }}
                >
                  {selectedNode.status === 'done' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>
                <input
                  type="text"
                  value={selectedNode.title}
                  onChange={(e) => handleUpdateNode(selectedNode.id, { title: e.target.value })}
                  style={{
                    width: '100%',
                    fontSize: '18px',
                    fontWeight: 700,
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-heading)',
                    fontFamily: 'Outfit, sans-serif',
                    padding: '2px 0'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                <select
                  value={selectedNode.priority}
                  onChange={(e) => handleUpdateNode(selectedNode.id, { priority: e.target.value })}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: PRIORITY_THEME[selectedNode.priority]?.color || 'var(--text-main)',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  <option value="now">Now Priority (Gold)</option>
                  <option value="next">Next Priority (Sky)</option>
                  <option value="later">Later Priority (Slate)</option>
                </select>

                <select
                  value={selectedNode.status}
                  onChange={(e) => handleUpdateNode(selectedNode.id, { status: e.target.value })}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '12px'
                  }}
                >
                  <option value="todo">To Do</option>
                  <option value="doing">In Progress</option>
                  <option value="done">Completed</option>
                </select>

                {selectedNode.isOverdue && (
                  <Badge variant="danger">Overdue Deadline</Badge>
                )}
              </div>
            </div>

            {/* Strategic WHY & HOW */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                WHY (Strategic Reasoning)
              </label>
              <textarea
                rows={3}
                placeholder="Why does this move the needle for Knotiq Rugs? Why is this action critical?"
                value={selectedNode.why || ''}
                onChange={(e) => handleUpdateNode(selectedNode.id, { why: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                HOW (Tactical Execution)
              </label>
              <textarea
                rows={3}
                placeholder="Exact step-by-step instructions: scripts, specs, suppliers, or workflows..."
                value={selectedNode.how || ''}
                onChange={(e) => handleUpdateNode(selectedNode.id, { how: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Due Date & KPI */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Target Due Date
                </label>
                <input
                  type="date"
                  value={selectedNode.dueDate ? String(selectedNode.dueDate).slice(0, 10) : ''}
                  onChange={(e) => handleUpdateNode(selectedNode.id, { dueDate: e.target.value || null })}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '12px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  KPI Target / Metric
                </label>
                <input
                  type="text"
                  placeholder="e.g. 50k AED or 5 samples"
                  value={selectedNode.kpiTarget || ''}
                  onChange={(e) => handleUpdateNode(selectedNode.id, { kpiTarget: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '12px'
                  }}
                />
              </div>
            </div>

            {/* Integration Action: Create Task in Command Center (Amendment 4) */}
            <div style={{ padding: '12px', background: 'var(--bg-surface-elevated)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                    Command Center Task
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {selectedNode.linkedTaskId ? 'Anchored to Task #' + selectedNode.linkedTaskId : 'Link to daily MITs and tasks hub'}
                  </div>
                </div>

                <Button
                  size="xs"
                  variant={selectedNode.linkedTaskId ? 'outline' : 'primary'}
                  onClick={() => handleCreateTaskFromNode(selectedNode)}
                >
                  {selectedNode.linkedTaskId ? 'Re-Sync Task' : 'Create Task'}
                </Button>
              </div>
            </div>

            {/* Bulk Actions for Subtree */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="outline"
                size="sm"
                style={{ flex: 1 }}
                onClick={() => handleAddChild(selectedNode.id)}
              >
                <Plus size={14} style={{ marginRight: '4px' }} /> Add Child
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCompleteDescendantsConfirm({ open: true, nodeId: selectedNode.id, count: 5 })}
                title="Mark all child items done"
              >
                Complete Track
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirm({ open: true, nodeId: selectedNode.id, count: 1 })}
                style={{ color: 'var(--danger-text)' }}
                title="Delete this node and all children"
              >
                <Trash2 size={14} />
              </Button>
            </div>

            {/* Embedded Notes Section */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={15} color="var(--gold-primary)" />
                Action Notes & Log
              </div>

              <form onSubmit={handleAddNote} style={{ marginBottom: '12px' }}>
                <textarea
                  rows={2}
                  placeholder="Add quick execution note..."
                  value={newNoteBody}
                  onChange={(e) => setNewNoteBody(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                    marginBottom: '6px',
                    resize: 'none'
                  }}
                />
                <Button type="submit" size="xs" variant="primary" disabled={creatingNote || !newNoteBody.trim()}>
                  {creatingNote ? 'Adding...' : 'Add Note'}
                </Button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {nodeNotes.length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', padding: '12px' }}>
                    No notes recorded for this action yet.
                  </div>
                ) : (
                  nodeNotes.map((note) => (
                    <div
                      key={note.id}
                      style={{
                        padding: '8px 10px',
                        background: 'var(--bg-surface-elevated)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>{note.body}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                        {new Date(note.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {/* Confirmation: Delete Subtree */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        title="Delete Mindmap Action Subtree?"
        message="Are you sure you want to delete this action node and all its child tracks? This action cannot be undone."
        confirmLabel="Delete Subtree"
        variant="danger"
        onConfirm={handleDeleteSubtree}
        onCancel={() => setDeleteConfirm({ open: false, nodeId: null, count: 1 })}
      />

      {/* Confirmation: Complete All Descendants (Amendment 6) */}
      <ConfirmDialog
        isOpen={completeDescendantsConfirm.open}
        title="Complete All Actions in Track?"
        message="Do you want to mark all child and descendant action nodes under this branch as completed as well?"
        confirmLabel="Mark All Completed"
        variant="primary"
        onConfirm={() => handleCompleteAllDescendants(completeDescendantsConfirm.nodeId)}
        onCancel={() => setCompleteDescendantsConfirm({ open: false, nodeId: null, count: 0 })}
      />
    </div>
  );
}
