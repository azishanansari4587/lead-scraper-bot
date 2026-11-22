import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Trash2,
  ExternalLink,
  Phone,
  Mail,
  Send,
  Sparkles,
  MapPin,
  X,
  Check,
  Copy,
  PlusCircle,
  Paperclip,
  FileText,
  CheckCircle2,
  MessageSquare,
  Globe,
  Tag,
  PhoneCall,
  Clock,
  History,
  AlertTriangle,
  Flame,
  CheckCheck,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';
import {
  Button,
  Field,
  Select,
  Textarea,
  Card,
  Modal,
  Drawer,
  Badge,
  StatusBadge,
  ScoreBadge,
  DataTable,
  Pagination,
  SkeletonRow,
  EmptyState,
  ConfirmDialog,
  useToast
} from '../components/ui';

// Configurable Business Constants
const DEFAULT_BUSINESS_PHONE = '+971 54 482 9117';
const DEFAULT_OUTREACH_EMAIL = 'info@knotiqrugs.com';

const BUYER_TYPE_OPTIONS = [
  { value: 'all', label: 'All Buyer Types' },
  { value: 'designer', label: 'Interior Designers' },
  { value: 'importer', label: 'Importers & Wholesalers' },
  { value: 'hotel', label: 'Hotels & Hospitality' },
  { value: 'retailer', label: 'Showrooms & Retailers' },
  { value: 'online_seller', label: 'Online Sellers' },
  { value: 'developer', label: 'Developers & Contractors' },
  { value: 'investor', label: 'Investors' },
  { value: 'homeowner', label: 'Homeowners' },
  { value: 'unclassified', label: 'Unclassified' }
];

const LEAD_CATEGORIES = [
  { value: 'rug_retailer', label: 'Rug / Carpet Retailer & Showroom' },
  { value: 'rug_wholesaler', label: 'Rug & Flooring Importer / Wholesaler' },
  { value: 'interior_designer', label: 'Interior Designer / Studio' },
  { value: 'interior_contractor', label: 'Fit-out / Interior Contractor' },
  { value: 'architect', label: 'Architect / Interior Architecture Firm' },
  { value: 'home_decor', label: 'Luxury Home Decor & Furniture Store' },
  { value: 'hospitality', label: 'Hospitality & Contract Furniture Buyer' },
  { value: 'other', label: 'Other B2B Buyer' }
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'new', label: 'New Lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'replied', label: 'Replied' },
  { value: 'sample_sent', label: 'Sample Sent' },
  { value: 'quotation', label: 'Quotation Sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won Deal' },
  { value: 'lost', label: 'Lost' },
  { value: 'repeat_client', label: 'Repeat Client' },
  { value: 'not_interested', label: 'Not Interested' }
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'hot', label: 'Hot (High Intent)' },
  { value: 'warm', label: 'Warm (Evaluating)' },
  { value: 'cold', label: 'Cold (Nurturing)' }
];

export default function Leads({ onExportRequested }) {
  const toast = useToast();

  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedBuyerType, setSelectedBuyerType] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [country, setCountry] = useState('');
  const [status, setStatus] = useState('');
  const [minScore, setMinScore] = useState('');
  const [sellsRugsOnly, setSellsRugsOnly] = useState(false);

  // Buyer type counts
  const [buyerTypeCounts, setBuyerTypeCounts] = useState({});

  // Sorting
  const [sortKey, setSortKey] = useState('score');
  const [sortDirection, setSortDirection] = useState('desc');

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Confirm delete dialog
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingLeads, setDeletingLeads] = useState(false);

  // Manual Lead Creation Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [newLead, setNewLead] = useState({
    businessName: '',
    leadType: 'rug_retailer',
    buyerType: 'unclassified',
    priority: 'warm',
    country: 'UAE',
    city: 'Dubai',
    state: '',
    address: '',
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    detail: '',
    project: '',
    platform: '',
    sizes: '',
    sellsRugsSignal: true,
    notes: ''
  });

  // Drawer
  const [selectedLead, setSelectedLead] = useState(null);
  const [drawerTab, setDrawerTab] = useState('outreach'); // 'outreach' | 'timeline' | 'notes'
  const [drawerNotes, setDrawerNotes] = useState('');
  const [drawerStatus, setDrawerStatus] = useState('new');
  const [drawerPriority, setDrawerPriority] = useState('warm');
  const [drawerBuyerType, setDrawerBuyerType] = useState('unclassified');
  const [initialDrawerState, setInitialDrawerState] = useState({ notes: '', status: '', priority: '', buyerType: '' });
  const [outreachDraft, setOutreachDraft] = useState(null);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Direct send in drawer
  const [drawerSubject, setDrawerSubject] = useState('');
  const [drawerBody, setDrawerBody] = useState('');
  const [drawerAttachments, setDrawerAttachments] = useState([]);
  const [uploadingDrawerAtt, setUploadingDrawerAtt] = useState(false);
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [sendSuccessMsg, setSendSuccessMsg] = useState('');

  // Drawer: Timeline
  const [timelineItems, setTimelineItems] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Drawer: Notes
  const [leadNotes, setLeadNotes] = useState([]);
  const [newLeadNoteText, setNewLeadNoteText] = useState('');
  const [savingLeadNote, setSavingLeadNote] = useState(false);

  // Log Call Modal (from table or drawer)
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callLead, setCallLead] = useState(null);
  const [callDirection, setCallDirection] = useState('outbound');
  const [callOutcome, setCallOutcome] = useState('connected');
  const [callDuration, setCallDuration] = useState('60');
  const [callSummary, setCallSummary] = useState('');
  const [callNextAction, setCallNextAction] = useState('');
  const [callFollowUpDate, setCallFollowUpDate] = useState('');
  const [savingCall, setSavingCall] = useState(false);

  // Mark Won Modal (Item 8)
  const [isWonModalOpen, setIsWonModalOpen] = useState(false);
  const [wonLeadTarget, setWonLeadTarget] = useState(null);
  const [wonDealValue, setWonDealValue] = useState('');
  const [wonDealCurrency, setWonDealCurrency] = useState('AED');
  const [savingWonDeal, setSavingWonDeal] = useState(false);
  const [drawerDealValue, setDrawerDealValue] = useState('');
  const [drawerDealCurrency, setDrawerDealCurrency] = useState('AED');

  // 300ms Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load leads whenever filters, pagination, or search change
  useEffect(() => {
    loadLeads();
  }, [page, pageSize, debouncedSearch, selectedBuyerType, priorityFilter, country, status, minScore, sellsRugsOnly]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const res = await api.getLeads({
        page,
        limit: pageSize,
        search: debouncedSearch.trim() || undefined,
        buyerType: selectedBuyerType === 'all' ? undefined : selectedBuyerType,
        priority: priorityFilter || undefined,
        country: country || undefined,
        status: status || undefined,
        minScore: minScore ? parseInt(minScore, 10) : undefined,
        sellsRugsOnly: sellsRugsOnly ? 'true' : undefined
      });

      setLeads(res.leads || []);
      setTotal(res.total || 0);
      if (res.buyerTypeCounts) {
        setBuyerTypeCounts(res.buyerTypeCounts);
      }
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err.message || 'Failed to load leads from database');
    } finally {
      setLoading(false);
    }
  };

  // Column sorting
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedLeads = useMemo(() => {
    if (!sortKey) return leads;
    return [...leads].sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      return sortDirection === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [leads, sortKey, sortDirection]);

  // Active filter chips
  const activeFilters = useMemo(() => {
    const chips = [];
    if (debouncedSearch) chips.push({ key: 'search', label: `Search: "${debouncedSearch}"`, clear: () => setSearchTerm('') });
    if (selectedBuyerType !== 'all') chips.push({ key: 'buyerType', label: `Buyer: ${selectedBuyerType.replace(/_/g, ' ')}`, clear: () => setSelectedBuyerType('all') });
    if (priorityFilter) chips.push({ key: 'priority', label: `Priority: ${priorityFilter}`, clear: () => setPriorityFilter('') });
    if (country) chips.push({ key: 'country', label: `Country: ${country}`, clear: () => setCountry('') });
    if (status) chips.push({ key: 'status', label: `Status: ${status}`, clear: () => setStatus('') });
    if (minScore) chips.push({ key: 'minScore', label: `Min Score: ≥${minScore}`, clear: () => setMinScore('') });
    if (sellsRugsOnly) chips.push({ key: 'sellsRugs', label: 'Rugs Verified Only', clear: () => setSellsRugsOnly(false) });
    return chips;
  }, [debouncedSearch, selectedBuyerType, priorityFilter, country, status, minScore, sellsRugsOnly]);

  const clearAllFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setSelectedBuyerType('all');
    setPriorityFilter('');
    setCountry('');
    setStatus('');
    setMinScore('');
    setSellsRugsOnly(false);
    setPage(1);
  };

  // Selection handlers
  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelectRow = (id, e) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    try {
      setDeletingLeads(true);
      await api.bulkDeleteLeads(Array.from(selectedIds));
      toast.success(`${selectedIds.size} leads deleted successfully.`);
      setSelectedIds(new Set());
      setConfirmDeleteOpen(false);
      loadLeads();
    } catch (err) {
      toast.error(`Bulk delete failed: ${err.message}`);
    } finally {
      setDeletingLeads(false);
    }
  };

  const handleBulkStatus = async (newStatus) => {
    if (!newStatus) return;
    try {
      await api.bulkUpdateLeadStatus(Array.from(selectedIds), newStatus);
      toast.success(`Updated ${selectedIds.size} leads to ${newStatus}.`);
      loadLeads();
    } catch (err) {
      toast.error(`Bulk status update failed: ${err.message}`);
    }
  };

  // Add Manual Lead
  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!newLead.businessName.trim() || !newLead.country.trim() || !newLead.city.trim()) {
      toast.error('Business Name, Country, and City are required fields.');
      return;
    }

    setSubmittingLead(true);
    try {
      const res = await api.createLead(newLead);
      setShowAddModal(false);
      setNewLead({
        businessName: '',
        leadType: 'rug_retailer',
        buyerType: 'unclassified',
        priority: 'warm',
        country: 'UAE',
        city: 'Dubai',
        state: '',
        address: '',
        phone: '',
        whatsapp: '',
        email: '',
        website: '',
        detail: '',
        project: '',
        platform: '',
        sizes: '',
        sellsRugsSignal: true,
        notes: ''
      });
      toast.success(`Lead "${res.lead.businessName}" added successfully.`);
      loadLeads();
    } catch (err) {
      toast.error(`Failed to add lead: ${err.message}`);
    } finally {
      setSubmittingLead(false);
    }
  };

  // In-place Buyer Type Change
  const handleInlineBuyerTypeChange = async (leadId, newBuyerType, e) => {
    e.stopPropagation();
    try {
      await api.updateLeadBuyerType(leadId, newBuyerType);
      toast.success(`Updated buyer type to ${newBuyerType}`);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, buyerType: newBuyerType, buyerTypeManual: true } : l))
      );
    } catch (err) {
      toast.error(`Failed to update buyer type: ${err.message}`);
    }
  };

  // Trigger AI / Rule Re-Classification
  const handleReclassify = async (leadId, e) => {
    e.stopPropagation();
    try {
      const res = await api.classifyLead(leadId);
      toast.success(`Classified as ${res.buyerType} (${Math.round((res.confidence || 0) * 100)}% conf)`);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? { ...l, buyerType: res.buyerType, buyerTypeConfidence: res.confidence, buyerTypeReason: res.reason }
            : l
        )
      );
    } catch (err) {
      toast.error(`Classification failed: ${err.message}`);
    }
  };

  // One-click Mark Replied
  const handleMarkReplied = async (leadId, e) => {
    if (e) e.stopPropagation();
    try {
      await api.markLeadReplied(leadId, 'Marked replied via quick action');
      toast.success('Lead marked as Replied! Pending follow-ups cancelled.');
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: 'replied' } : l))
      );
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead((prev) => ({ ...prev, status: 'replied' }));
        setDrawerStatus('replied');
      }
    } catch (err) {
      toast.error(`Failed to mark replied: ${err.message}`);
    }
  };

  // Call Button Action (tel: link + open log call modal)
  const handleInitiateCall = (lead, e) => {
    if (e) e.stopPropagation();
    if (lead.optedOut) {
      toast.error('This lead has opted out. Calls are blocked.');
      return;
    }
    const phoneToCall = lead.phone || lead.whatsapp;
    if (phoneToCall) {
      const cleanPhone = phoneToCall.replace(/[^0-9+]/g, '');
      window.open(`tel:${cleanPhone}`, '_self');
    }
    setCallLead(lead);
    setCallDirection('outbound');
    setCallOutcome('connected');
    setCallDuration('60');
    setCallSummary('');
    setCallNextAction('');
    setCallFollowUpDate('');
    setCallModalOpen(true);
  };

  const handleSaveCallLog = async (e) => {
    e.preventDefault();
    if (!callLead) return;

    setSavingCall(true);
    try {
      await api.logCall({
        leadId: callLead.id,
        direction: callDirection,
        outcome: callOutcome,
        durationSec: parseInt(callDuration, 10) || 0,
        summary: callSummary.trim() || undefined,
        nextAction: callNextAction.trim() || undefined,
        nextFollowUpAt: callFollowUpDate ? new Date(callFollowUpDate).toISOString() : undefined
      });
      toast.success(`Call logged for ${callLead.businessName}`);
      setCallModalOpen(false);
      loadLeads();
    } catch (err) {
      if (err.status === 403 || err.message?.includes('Opted out')) {
        toast.error('Compliance violation: This lead or phone number is in Opt-Out list.');
      } else {
        toast.error(`Failed to log call: ${err.message}`);
      }
    } finally {
      setSavingCall(false);
    }
  };

  // Open Drawer
  const handleOpenDrawer = (lead) => {
    setSelectedLead(lead);
    setDrawerTab('outreach');
    setDrawerNotes(lead.notes || '');
    setDrawerStatus(lead.status || 'new');
    setDrawerPriority(lead.priority || 'warm');
    setDrawerBuyerType(lead.buyerType || 'unclassified');
    setDrawerDealValue(lead.dealValue !== null && lead.dealValue !== undefined ? String(lead.dealValue) : '');
    setDrawerDealCurrency(lead.dealCurrency || 'AED');
    setInitialDrawerState({
      notes: lead.notes || '',
      status: lead.status || 'new',
      priority: lead.priority || 'warm',
      buyerType: lead.buyerType || 'unclassified'
    });
    setOutreachDraft(null);
    setCopiedDraft(false);
    setDrawerSubject(`Trade Partnership: Handmade Bespoke Rugs for ${lead.businessName}`);
    setDrawerBody(
      `Hello ${lead.businessName} Team,\n\nWe admire your portfolio. Knotiq Rugs is a premier direct manufacturer of hand-knotted and hand-tufted carpets in India, partnering with luxury interior designers, architects, and high-end showrooms.\n\nWe offer bespoke custom sizes, certified wool/silk yarn matching, and competitive direct trade pricing.\n\nCould we share our 2026 digital trade catalog and send a complimentary yarn sample box for your library?\n\nWarm regards,\nExport Team | Knotiq Rugs\n${DEFAULT_OUTREACH_EMAIL} | ${DEFAULT_BUSINESS_PHONE}`
    );
    setDrawerAttachments([]);
    setSendSuccessMsg('');
    loadTimeline(lead.id);
    loadLeadNotes(lead.id);
  };

  const loadTimeline = async (leadId) => {
    try {
      setLoadingTimeline(true);
      const res = await api.getLeadTimeline(leadId);
      setTimelineItems(res.timeline || []);
    } catch (_) {
      setTimelineItems([]);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const loadLeadNotes = async (leadId) => {
    try {
      const res = await api.getNotes({ ownerType: 'lead', ownerId: leadId });
      setLeadNotes(res.notes || []);
    } catch (_) {
      setLeadNotes([]);
    }
  };

  const handleAddLeadNote = async (e) => {
    e.preventDefault();
    if (!newLeadNoteText.trim() || !selectedLead) return;

    setSavingLeadNote(true);
    try {
      await api.createNote({
        ownerType: 'lead',
        ownerId: selectedLead.id,
        body: newLeadNoteText.trim()
      });
      setNewLeadNoteText('');
      toast.success('Note added to lead.');
      loadLeadNotes(selectedLead.id);
      loadTimeline(selectedLead.id);
    } catch (err) {
      toast.error(`Failed to add note: ${err.message}`);
    } finally {
      setSavingLeadNote(false);
    }
  };

  // Mark Won helpers (Item 8)
  const promptMarkWon = (lead) => {
    setWonLeadTarget(lead);
    setWonDealValue(lead.dealValue !== null && lead.dealValue !== undefined ? String(lead.dealValue) : '');
    setWonDealCurrency(lead.dealCurrency || 'AED');
    setIsWonModalOpen(true);
  };

  const handleConfirmWonDeal = async (includeValue = true) => {
    if (!wonLeadTarget) return;
    setSavingWonDeal(true);
    try {
      const updates = {
        status: 'won',
        dealValue: includeValue && wonDealValue ? parseFloat(wonDealValue) : null,
        dealCurrency: wonDealCurrency || 'AED'
      };
      await api.updateLead(wonLeadTarget.id, updates);
      toast.success(
        includeValue && wonDealValue
          ? `Deal marked Won! Recorded ${updates.dealCurrency} ${parseFloat(wonDealValue).toLocaleString()}`
          : 'Deal marked Won without deal value.'
      );
      setIsWonModalOpen(false);
      setLeads((prev) => prev.map((l) => (l.id === wonLeadTarget.id ? { ...l, ...updates } : l)));
      if (selectedLead && selectedLead.id === wonLeadTarget.id) {
        setSelectedLead((prev) => ({ ...prev, ...updates }));
        setDrawerStatus('won');
        setDrawerDealValue(updates.dealValue !== null ? String(updates.dealValue) : '');
        setDrawerDealCurrency(updates.dealCurrency);
      }
      loadLeads();
    } catch (err) {
      toast.error(`Failed to mark won: ${err.message}`);
    } finally {
      setSavingWonDeal(false);
    }
  };

  const hasDrawerUnsavedChanges =
    Boolean(selectedLead) &&
    (drawerNotes !== initialDrawerState.notes ||
      drawerStatus !== initialDrawerState.status ||
      drawerPriority !== initialDrawerState.priority ||
      drawerBuyerType !== initialDrawerState.buyerType ||
      drawerDealValue !== (selectedLead.dealValue !== null && selectedLead.dealValue !== undefined ? String(selectedLead.dealValue) : '') ||
      drawerDealCurrency !== (selectedLead.dealCurrency || 'AED'));

  const saveLeadChanges = async () => {
    if (!selectedLead) return;
    try {
      await api.updateLead(selectedLead.id, {
        notes: drawerNotes,
        status: drawerStatus,
        priority: drawerPriority,
        buyerType: drawerBuyerType,
        dealValue: drawerDealValue ? parseFloat(drawerDealValue) : null,
        dealCurrency: drawerDealCurrency || 'AED'
      });
      toast.success('Lead updated successfully.');
      setSelectedLead(null);
      loadLeads();
    } catch (err) {
      toast.error(`Failed to save changes: ${err.message}`);
    }
  };

  const handleGenerateDraft = async (channel = 'email') => {
    if (!selectedLead) return;
    setGeneratingDraft(true);
    setSendSuccessMsg('');
    try {
      const res = await api.generateDraft(selectedLead.id, channel);
      setOutreachDraft(res.draft);
      if (res.draft?.subject) setDrawerSubject(res.draft.subject);
      if (res.draft?.message) setDrawerBody(res.draft.message);
      toast.success('Personalized AI outreach draft generated.');
    } catch (err) {
      toast.error(`Draft generation failed: ${err.message}`);
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleCopyDraft = () => {
    const fullText = drawerSubject ? `Subject: ${drawerSubject}\n\n${drawerBody}` : drawerBody;
    navigator.clipboard.writeText(fullText);
    setCopiedDraft(true);
    toast.info('Draft copied to clipboard.');
    setTimeout(() => setCopiedDraft(false), 2500);
  };

  const handleDrawerAttachmentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error('File size exceeds the 15 MB limit.');
      return;
    }

    setUploadingDrawerAtt(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.uploadAttachment(fd);
      setDrawerAttachments((prev) => [...prev, res.file]);
      toast.success(`Attached "${res.file.filename}".`);
    } catch (err) {
      toast.error(`Attachment upload error: ${err.message}`);
    } finally {
      setUploadingDrawerAtt(false);
      e.target.value = '';
    }
  };

  const handleRemoveDrawerAttachment = (idx) => {
    setDrawerAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleOpenWhatsAppWeb = () => {
    if (!selectedLead) return;
    const phoneNum = selectedLead.whatsapp || selectedLead.phone;
    if (!phoneNum) {
      toast.error('This lead does not have a recorded phone or WhatsApp number.');
      return;
    }
    const cleanPhone = phoneNum.replace(/[^0-9]/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(drawerBody || '')}`;
    window.open(waUrl, '_blank');
    api.recordSent(selectedLead.id, 'whatsapp').catch(() => {});
    toast.success('WhatsApp chat initiated in new tab. Day 4 & Day 7 follow-ups scheduled.');
  };

  const handleSendDirectOutreach = async (channel = 'email') => {
    if (!selectedLead) return;
    if (!drawerBody.trim()) {
      toast.error('Message body cannot be empty.');
      return;
    }

    if (channel === 'whatsapp') {
      const phoneNum = selectedLead.whatsapp || selectedLead.phone;
      if (!phoneNum) {
        toast.error('This lead does not have a recorded phone or WhatsApp number.');
        return;
      }
    } else {
      if (!selectedLead.email) {
        toast.error('This lead does not have a valid email address.');
        return;
      }
    }

    setSendingOutreach(true);
    setSendSuccessMsg('');
    try {
      const res = await api.sendDirectOutreach({
        leadId: selectedLead.id,
        channel,
        recipientEmail: selectedLead.email,
        subject: drawerSubject.trim(),
        body: drawerBody.trim(),
        message: drawerBody.trim(),
        attachments: drawerAttachments
      });
      const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : 'Email';
      setSendSuccessMsg(res.message || `${channelLabel} sent successfully.`);
      toast.success(res.message || `${channelLabel} sent successfully.`);
      loadLeads();
      loadTimeline(selectedLead.id);
    } catch (err) {
      toast.error(`Outreach delivery failed: ${err.message}`);
    } finally {
      setSendingOutreach(false);
    }
  };

  // Table columns definition
  const columns = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          aria-label="Select all leads on current page"
          checked={leads.length > 0 && selectedIds.size === leads.length}
          onChange={handleToggleSelectAll}
          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--gold-primary)' }}
        />
      ),
      width: '40px',
      render: (_, row) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.businessName}`}
          checked={selectedIds.has(row.id)}
          onChange={(e) => handleToggleSelectRow(row.id, e)}
          onClick={(e) => e.stopPropagation()}
          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--gold-primary)' }}
        />
      )
    },
    {
      key: 'businessName',
      label: 'Business Name',
      sortable: true,
      render: (name, row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {name}
            {row.optedOut && (
              <span style={{ fontSize: '10px', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger-text)', padding: '1px 5px', borderRadius: '4px' }}>
                OPT-OUT
              </span>
            )}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            {row.city || 'Unknown City'}, {row.country || 'Global'}
          </div>
        </div>
      )
    },
    {
      key: 'buyerType',
      label: 'Buyer Type',
      sortable: true,
      render: (bt, row) => {
        const currentType = bt || 'unclassified';
        const confPct = row.buyerTypeConfidence ? Math.round(row.buyerTypeConfidence * 100) : null;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
            <select
              value={currentType}
              onChange={(e) => handleInlineBuyerTypeChange(row.id, e.target.value, e)}
              className="select"
              style={{
                fontSize: '11px',
                padding: '3px 6px',
                background: 'var(--bg-app)',
                borderColor: currentType === 'unclassified' ? 'var(--border-subtle)' : 'var(--gold-primary)',
                color: 'var(--text-heading)',
                borderRadius: 'var(--radius-sm)'
              }}
              title={row.buyerTypeReason || 'Click to change buyer type'}
            >
              <option value="unclassified">Unclassified</option>
              <option value="designer">Interior Designer</option>
              <option value="importer">Importer / Wholesaler</option>
              <option value="hotel">Hotel / Hospitality</option>
              <option value="retailer">Showroom / Retailer</option>
              <option value="online_seller">Online Seller</option>
              <option value="developer">Developer</option>
              <option value="investor">Investor</option>
              <option value="homeowner">Homeowner</option>
            </select>

            {confPct !== null && confPct > 0 && (
              <span
                style={{
                  fontSize: '9px',
                  color: confPct >= 80 ? 'var(--success)' : 'var(--text-dim)',
                  fontWeight: 600
                }}
                title={`Confidence: ${confPct}% - ${row.buyerTypeReason || ''}`}
              >
                {confPct}%
              </span>
            )}

            <button
              type="button"
              className="btn-icon btn-ghost btn-sm"
              onClick={(e) => handleReclassify(row.id, e)}
              title="Re-classify with AI / Rules"
              style={{ padding: '2px', color: 'var(--text-dim)' }}
            >
              <Sparkles size={11} />
            </button>
          </div>
        );
      }
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (priority) => {
        const p = priority || 'warm';
        if (p === 'hot') {
          return (
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <Flame size={12} /> HOT
            </span>
          );
        }
        if (p === 'warm') {
          return (
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--gold-primary)', fontWeight: 600 }}>
              WARM
            </span>
          );
        }
        return (
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-muted)' }}>
            COLD
          </span>
        );
      }
    },
    {
      key: 'score',
      label: 'Fit Score',
      sortable: true,
      render: (score) => <ScoreBadge score={score} />
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (status) => <StatusBadge status={status} />
    },
    {
      key: 'quickEngage',
      label: 'Quick Engage',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
          {(row.phone || row.whatsapp) && !row.optedOut ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={(e) => handleInitiateCall(row, e)}
              style={{ fontSize: '11px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              title="Call Lead & Log Call"
            >
              <PhoneCall size={12} color="var(--info)" /> Call
            </button>
          ) : null}

          {row.status !== 'replied' && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={(e) => handleMarkReplied(row.id, e)}
              style={{ fontSize: '11px', padding: '2px 6px', color: 'var(--gold-primary)' }}
              title="Mark as Replied (cancels scheduled follow-ups)"
            >
              <CheckCheck size={13} /> Replied
            </button>
          )}

          {row.website && (
            <a
              href={row.website}
              target="_blank"
              rel="noreferrer"
              title={`Website: ${row.website}`}
              style={{ color: 'var(--text-muted)', display: 'inline-flex', padding: '2px' }}
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="page-content">
      {/* Buyer Type Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'thin' }}>
        {BUYER_TYPE_OPTIONS.map((bt) => {
          const count = bt.value === 'all' ? total : (buyerTypeCounts[bt.value] || 0);
          const isActive = selectedBuyerType === bt.value;
          return (
            <button
              key={bt.value}
              type="button"
              onClick={() => { setSelectedBuyerType(bt.value); setPage(1); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                border: isActive ? '1px solid var(--gold-primary)' : '1px solid var(--border-subtle)',
                background: isActive ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-surface)',
                color: isActive ? 'var(--gold-primary)' : 'var(--text-main)'
              }}
            >
              <span>{bt.label}</span>
              <span
                style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: isActive ? 'var(--gold-primary)' : 'var(--bg-app)',
                  color: isActive ? '#000' : 'var(--text-muted)',
                  fontWeight: 700
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Header with Search, Filter controls, and Actions */}
      <Card>
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <Sparkles size={20} color="var(--gold-primary)" aria-hidden="true" />
              B2B Lead Intelligence Pipeline
            </h2>
            <p className="page-subtitle">
              Qualify, classify buyer type, initiate calls, and manage multi-step outreach sequences.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="secondary"
              icon={PlusCircle}
              onClick={() => setShowAddModal(true)}
            >
              Add Lead
            </Button>
            <Button
              variant="primary"
              onClick={onExportRequested}
            >
              Export Selected
            </Button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="filter-row">
          <div style={{ flex: 1, minWidth: '220px' }}>
            <Field id="lead-search">
              <input
                id="lead-search"
                type="search"
                className="input"
                placeholder="Search company, city, contact, or detail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search leads"
              />
            </Field>
          </div>

          <div style={{ width: '150px' }}>
            <Select
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
              aria-label="Filter by priority"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </div>

          <div style={{ width: '160px' }}>
            <Select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              aria-label="Filter by pipeline status"
            >
              {STATUS_OPTIONS.map((st) => (
                <option key={st.value} value={st.value}>{st.label}</option>
              ))}
            </Select>
          </div>

          <div style={{ width: '140px' }}>
            <Select
              value={minScore}
              onChange={(e) => { setMinScore(e.target.value); setPage(1); }}
              aria-label="Filter by qualification score"
            >
              <option value="">Any Score</option>
              <option value="70">≥ 70 (High Fit)</option>
              <option value="40">≥ 40 (Med+ Fit)</option>
            </Select>
          </div>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--font-xs)', color: 'var(--text-main)', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={sellsRugsOnly}
              onChange={(e) => { setSellsRugsOnly(e.target.checked); setPage(1); }}
              style={{ width: '16px', height: '16px', accentColor: 'var(--gold-primary)', cursor: 'pointer' }}
            />
            <span>Rugs Verified Only</span>
          </label>
        </div>

        {/* Active Filter Chips */}
        {activeFilters.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', fontWeight: 600 }}>Active Filters:</span>
            {activeFilters.map((chip) => (
              <span key={chip.key} className="filter-chip">
                {chip.label}
                <button
                  type="button"
                  className="filter-chip-remove"
                  onClick={chip.clear}
                  aria-label={`Remove filter ${chip.label}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={clearAllFilters}
              style={{ fontSize: 'var(--font-xs)', padding: '2px 8px' }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-surface-elevated)',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-accent)',
              marginTop: '16px'
            }}
          >
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-heading)' }}>
              <strong>{selectedIds.size}</strong> leads selected
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Select
                onChange={(e) => handleBulkStatus(e.target.value)}
                style={{ width: 'auto', padding: '4px 8px', fontSize: 'var(--font-xs)' }}
                defaultValue=""
                aria-label="Bulk update pipeline status"
              >
                <option value="" disabled>Change Status...</option>
                <option value="contacted">Mark as Contacted</option>
                <option value="replied">Mark as Replied</option>
                <option value="sample_sent">Sample Sent</option>
                <option value="quotation">Quotation Sent</option>
                <option value="won">Mark as Won Deal</option>
                <option value="lost">Mark as Lost</option>
                <option value="not_interested">Mark as Not Interested</option>
              </Select>

              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={() => setConfirmDeleteOpen(true)}
              >
                Delete Selected
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Main Leads Data Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={sortedLeads}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={handleOpenDrawer}
          emptyContent={
            loading ? (
              <table style={{ width: '100%' }}>
                <tbody>
                  <SkeletonRow columns={7} />
                  <SkeletonRow columns={7} />
                  <SkeletonRow columns={7} />
                </tbody>
              </table>
            ) : (
              <EmptyState
                title="No matching leads found"
                description={
                  activeFilters.length > 0
                    ? "Try adjusting or clearing your filters to discover more targets."
                    : "No B2B leads in database. Run a live scrape to discover buyers."
                }
                action={
                  activeFilters.length > 0 ? (
                    <Button variant="secondary" size="sm" onClick={clearAllFilters}>
                      Clear Filters
                    </Button>
                  ) : null
                }
              />
            )
          }
        />

        <Pagination
          currentPage={page}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }}
        />
      </Card>

      {/* Manual Lead Creation Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Manual B2B Target / Inbound Lead"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={submittingLead}
              onClick={handleCreateLead}
            >
              Save Lead to Database
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Business / Contact Name" required id="new-lead-name">
            <input
              id="new-lead-name"
              className="input"
              placeholder="e.g. Al Maktoum Luxury Interiors LLC or John Smith"
              value={newLead.businessName}
              onChange={(e) => setNewLead({ ...newLead, businessName: e.target.value })}
              required
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Buyer Type" required id="new-lead-buyer-type">
              <Select
                id="new-lead-buyer-type"
                value={newLead.buyerType}
                onChange={(e) => setNewLead({ ...newLead, buyerType: e.target.value })}
              >
                <option value="unclassified">Unclassified</option>
                <option value="designer">Interior Designer</option>
                <option value="importer">Importer / Wholesaler</option>
                <option value="hotel">Hotel / Hospitality</option>
                <option value="retailer">Showroom / Retailer</option>
                <option value="online_seller">Online Seller</option>
                <option value="developer">Developer</option>
                <option value="investor">Investor</option>
                <option value="homeowner">Homeowner (Inbound)</option>
              </Select>
            </Field>

            <Field label="Priority" id="new-lead-priority">
              <Select
                id="new-lead-priority"
                value={newLead.priority}
                onChange={(e) => setNewLead({ ...newLead, priority: e.target.value })}
              >
                <option value="hot">Hot (Ready to buy)</option>
                <option value="warm">Warm (Exploring)</option>
                <option value="cold">Cold</option>
              </Select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Country" required id="new-lead-country">
              <input
                id="new-lead-country"
                className="input"
                placeholder="UAE, USA, Germany..."
                value={newLead.country}
                onChange={(e) => setNewLead({ ...newLead, country: e.target.value })}
                required
              />
            </Field>

            <Field label="City" required id="new-lead-city">
              <input
                id="new-lead-city"
                className="input"
                placeholder="Dubai, Abu Dhabi, London..."
                value={newLead.city}
                onChange={(e) => setNewLead({ ...newLead, city: e.target.value })}
                required
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Phone / Mobile" id="new-lead-phone">
              <input
                id="new-lead-phone"
                className="input"
                placeholder="+971 50 123 4567"
                value={newLead.phone}
                onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
              />
            </Field>

            <Field label="Email Address" id="new-lead-email">
              <input
                id="new-lead-email"
                type="email"
                className="input"
                placeholder="buyer@interiorstudio.com"
                value={newLead.email}
                onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Website URL" id="new-lead-website">
            <input
              id="new-lead-website"
              className="input"
              placeholder="https://interiorstudio.ae"
              value={newLead.website}
              onChange={(e) => setNewLead({ ...newLead, website: e.target.value })}
            />
          </Field>

          <Field label="Real Observation / Detail (for templates)" id="new-lead-detail">
            <input
              id="new-lead-detail"
              className="input"
              placeholder="e.g. Palm Jumeirah luxury villa interior project"
              value={newLead.detail}
              onChange={(e) => setNewLead({ ...newLead, detail: e.target.value })}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Project Name (Optional)" id="new-lead-project">
              <input
                id="new-lead-project"
                className="input"
                placeholder="e.g. Downtown Penthouse"
                value={newLead.project}
                onChange={(e) => setNewLead({ ...newLead, project: e.target.value })}
              />
            </Field>

            <Field label="Preferred Sizes (Optional)" id="new-lead-sizes">
              <input
                id="new-lead-sizes"
                className="input"
                placeholder="e.g. 8x10, 9x12 ft"
                value={newLead.sizes}
                onChange={(e) => setNewLead({ ...newLead, sizes: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Internal Notes / Buyer Preferences" id="new-lead-notes">
            <Textarea
              id="new-lead-notes"
              placeholder="e.g. Prefers custom wool hand-tufted rugs, wants yarn swatches..."
              value={newLead.notes}
              onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
            />
          </Field>
        </form>
      </Modal>

      {/* Log Call Modal */}
      <Modal
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        title={callLead ? `Log Call: ${callLead.businessName}` : 'Log Call'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCallModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={savingCall} onClick={handleSaveCallLog}>
              Save Call Record
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveCallLog} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {callLead && (
            <div style={{ background: 'var(--bg-app)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', border: '1px solid var(--border-subtle)' }}>
              <div><strong>Target:</strong> {callLead.businessName}</div>
              <div><strong>Phone:</strong> {callLead.phone || callLead.whatsapp || 'No direct phone recorded'}</div>
              <div><strong>Location:</strong> {callLead.city}, {callLead.country}</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Call Direction" id="call-direction">
              <Select value={callDirection} onChange={(e) => setCallDirection(e.target.value)}>
                <option value="outbound">Outbound Call</option>
                <option value="inbound">Inbound Call</option>
              </Select>
            </Field>

            <Field label="Call Outcome" id="call-outcome">
              <Select value={callOutcome} onChange={(e) => setCallOutcome(e.target.value)}>
                <option value="connected">Connected / Spoke with Buyer</option>
                <option value="no_answer">No Answer</option>
                <option value="busy">Line Busy</option>
                <option value="voicemail">Left Voicemail</option>
                <option value="callback_requested">Callback Requested</option>
                <option value="interested">Interested (Wants Catalog/Samples)</option>
                <option value="not_interested">Not Interested</option>
                <option value="wrong_number">Wrong Number</option>
              </Select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Duration (Seconds)" id="call-duration">
              <input
                id="call-duration"
                type="number"
                className="input"
                value={callDuration}
                onChange={(e) => setCallDuration(e.target.value)}
              />
            </Field>

            <Field label="Schedule Next Follow-up (Optional)" id="call-follow-up">
              <input
                id="call-follow-up"
                type="datetime-local"
                className="input"
                value={callFollowUpDate}
                onChange={(e) => setCallFollowUpDate(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Call Summary & Takeaways" id="call-summary">
            <Textarea
              id="call-summary"
              rows={3}
              placeholder="e.g. Spoke to procurement manager. They have 2 hotel projects in Downtown Dubai needing 80+ custom carpets..."
              value={callSummary}
              onChange={(e) => setCallSummary(e.target.value)}
            />
          </Field>

          <Field label="Immediate Next Action" id="call-next-action">
            <input
              id="call-next-action"
              className="input"
              placeholder="e.g. Email 2026 digital hospitality catalog & WhatsApp yarn kit photos"
              value={callNextAction}
              onChange={(e) => setCallNextAction(e.target.value)}
            />
          </Field>
        </form>
      </Modal>

      {/* Upgraded Lead Detail, Timeline & Outreach Drawer */}
      <Drawer
        isOpen={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        title={selectedLead?.businessName}
        subtitle={`${selectedLead?.buyerType || 'unclassified'} • ${selectedLead?.city}, ${selectedLead?.country}`}
        hasUnsavedChanges={hasDrawerUnsavedChanges}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedLead(null)}>
              Close
            </Button>
            <Button variant="primary" onClick={saveLeadChanges}>
              Save Lead Changes
            </Button>
          </>
        }
      >
        {selectedLead && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Drawer Tab Navigation */}
            <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <button
                type="button"
                className={`btn btn-sm ${drawerTab === 'outreach' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setDrawerTab('outreach')}
              >
                <Send size={13} /> Outreach & Details
              </button>
              <button
                type="button"
                className={`btn btn-sm ${drawerTab === 'timeline' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setDrawerTab('timeline')}
              >
                <History size={13} /> Activity Timeline ({timelineItems.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${drawerTab === 'notes' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setDrawerTab('notes')}
              >
                <FileText size={13} /> Lead Notes ({leadNotes.length})
              </button>
            </div>

            {/* TAB 1: Outreach & Details */}
            {drawerTab === 'outreach' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Qualification & Buyer Classification Card */}
                <Card style={{ background: 'var(--bg-surface-elevated)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Buyer Classification & Fit
                    </span>
                    <ScoreBadge score={selectedLead.score} style={{ fontSize: 'var(--font-sm)', padding: '4px 10px' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                    <Field label="Buyer Type" id="drawer-buyer-type">
                      <Select value={drawerBuyerType} onChange={(e) => setDrawerBuyerType(e.target.value)}>
                        <option value="unclassified">Unclassified</option>
                        <option value="designer">Interior Designer</option>
                        <option value="importer">Importer / Wholesaler</option>
                        <option value="hotel">Hotel / Hospitality</option>
                        <option value="retailer">Showroom / Retailer</option>
                        <option value="online_seller">Online Seller</option>
                        <option value="developer">Developer</option>
                        <option value="investor">Investor</option>
                        <option value="homeowner">Homeowner</option>
                      </Select>
                    </Field>

                    <Field label="Priority Level" id="drawer-priority">
                      <Select value={drawerPriority} onChange={(e) => setDrawerPriority(e.target.value)}>
                        <option value="hot">Hot (High Intent)</option>
                        <option value="warm">Warm</option>
                        <option value="cold">Cold</option>
                      </Select>
                    </Field>
                  </div>

                  {selectedLead.detail && (
                    <div style={{ marginTop: '8px', fontSize: 'var(--font-xs)', color: 'var(--gold-primary)', background: 'rgba(245, 158, 11, 0.08)', padding: '6px 10px', borderRadius: '4px' }}>
                      <strong>Real Observation:</strong> {selectedLead.detail}
                    </div>
                  )}
                </Card>

                {/* Direct Outreach Channels */}
                <Card style={{ background: 'var(--bg-surface-elevated)' }}>
                  <h4 style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--gold-primary)', marginBottom: '12px', textTransform: 'uppercase' }}>
                    Direct Outreach & Calls
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--font-xs)' }}>
                    {(selectedLead.phone || selectedLead.whatsapp) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span><strong>Phone:</strong> {selectedLead.phone || selectedLead.whatsapp}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={PhoneCall}
                            onClick={() => handleInitiateCall(selectedLead)}
                            style={{ color: 'var(--info)' }}
                          >
                            Call & Log
                          </Button>
                          <a
                            className="btn btn-secondary btn-sm"
                            href={`https://wa.me/${(selectedLead.whatsapp || selectedLead.phone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello ' + selectedLead.businessName + ', this is Knotiq Rugs regarding handmade bespoke carpets.')}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--success)' }}
                          >
                            <MessageSquare size={13} aria-hidden="true" /> WA Chat
                          </a>
                        </div>
                      </div>
                    )}

                    {selectedLead.email && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span><strong>Email:</strong> {selectedLead.email}</span>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Sparkles}
                          loading={generatingDraft}
                          onClick={() => handleGenerateDraft('email')}
                        >
                          AI Cold Email
                        </Button>
                      </div>
                    )}

                    {selectedLead.website && (
                      <div>
                        <strong>Website:</strong>{' '}
                        <a
                          href={selectedLead.website}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--gold-primary)', textDecoration: 'underline' }}
                        >
                          {selectedLead.website}
                        </a>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Send Direct Email / WhatsApp with Attachments */}
                <Card style={{ background: 'rgba(217, 119, 6, 0.05)', borderColor: 'var(--border-accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} aria-hidden="true" /> Direct Outreach Composer
                    </span>
                    {outreachDraft && (
                      <Button variant="secondary" size="sm" onClick={handleCopyDraft}>
                        {copiedDraft ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                      </Button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <Field label="Subject" id="drawer-email-subject">
                      <input
                        id="drawer-email-subject"
                        className="input"
                        value={drawerSubject}
                        onChange={(e) => setDrawerSubject(e.target.value)}
                      />
                    </Field>

                    <Field label="Message Body" id="drawer-email-body">
                      <Textarea
                        id="drawer-email-body"
                        rows={5}
                        value={drawerBody}
                        onChange={(e) => setDrawerBody(e.target.value)}
                      />
                    </Field>

                    {/* Attached files */}
                    {drawerAttachments.length > 0 && (
                      <div>
                        <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                          Attached Files ({drawerAttachments.length}):
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {drawerAttachments.map((att, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'var(--bg-app)',
                                padding: '6px 10px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 'var(--font-xs)'
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                                <FileText size={13} color="var(--gold-primary)" aria-hidden="true" />
                                {att.filename} ({Math.round((att.size || 0) / 1024)} KB)
                              </span>
                              <button
                                type="button"
                                className="btn-icon btn-ghost btn-sm"
                                onClick={() => handleRemoveDrawerAttachment(idx)}
                                style={{ color: 'var(--danger-text)' }}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions & File upload */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', flexWrap: 'wrap', gap: '8px' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <span className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Paperclip size={13} aria-hidden="true" />
                          {uploadingDrawerAtt ? 'Uploading...' : 'Attach PDF / Image'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                          style={{ display: 'none' }}
                          onChange={handleDrawerAttachmentUpload}
                          disabled={uploadingDrawerAtt}
                        />
                      </label>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {(selectedLead.phone || selectedLead.whatsapp) && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={MessageSquare}
                              loading={sendingOutreach}
                              onClick={() => handleSendDirectOutreach('whatsapp')}
                              style={{ color: 'var(--success)', borderColor: 'var(--success-border)' }}
                              title="Send WhatsApp via Cloud API"
                            >
                              Send WhatsApp
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={ExternalLink}
                              onClick={handleOpenWhatsAppWeb}
                              style={{ color: 'var(--text-secondary)' }}
                              title="Open in WhatsApp Web"
                            >
                              WA Web
                            </Button>
                          </>
                        )}
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Send}
                          loading={sendingOutreach}
                          onClick={() => handleSendDirectOutreach('email')}
                          disabled={!selectedLead.email}
                        >
                          Send Email
                        </Button>
                      </div>
                    </div>

                    {sendSuccessMsg && (
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <CheckCircle2 size={13} aria-hidden="true" /> {sendSuccessMsg}
                      </div>
                    )}
                  </div>
                </Card>

                {/* Pipeline Status & Internal Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <Field label="Lead Pipeline Status" id="drawer-lead-status">
                    <Select
                      id="drawer-lead-status"
                      value={drawerStatus}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDrawerStatus(val);
                        if (val === 'won' && selectedLead && selectedLead.status !== 'won') {
                          promptMarkWon(selectedLead);
                        }
                      }}
                    >
                      {STATUS_OPTIONS.filter((s) => s.value).map((st) => (
                        <option key={st.value} value={st.value}>{st.label}</option>
                      ))}
                    </Select>
                  </Field>

                  {drawerStatus === 'won' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', padding: '10px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <Field label="Deal Value (Won Revenue)">
                        <input
                          type="number"
                          step="0.01"
                          value={drawerDealValue}
                          onChange={(e) => setDrawerDealValue(e.target.value)}
                          placeholder="e.g. 25000"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            backgroundColor: 'var(--surface-subtle)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--emerald-accent)',
                            fontWeight: 700,
                            fontSize: 'var(--font-sm)'
                          }}
                        />
                      </Field>
                      <Field label="Currency">
                        <input
                          type="text"
                          value={drawerDealCurrency}
                          onChange={(e) => setDrawerDealCurrency(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            backgroundColor: 'var(--surface-subtle)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-primary)',
                            fontSize: 'var(--font-sm)'
                          }}
                        />
                      </Field>
                    </div>
                  )}

                  <Field label="Internal Notes & Interactions" id="drawer-lead-notes">
                    <Textarea
                      id="drawer-lead-notes"
                      rows={4}
                      placeholder="Record call notes, preferred rug dimensions, buyer timeline..."
                      value={drawerNotes}
                      onChange={(e) => setDrawerNotes(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* TAB 2: Activity Timeline */}
            {drawerTab === 'timeline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', fontWeight: 600 }}>
                    Chronological activity log (outreach, calls, notes, follow-ups)
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => loadTimeline(selectedLead.id)}
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                  >
                    <RefreshCw size={11} /> Refresh
                  </button>
                </div>

                {loadingTimeline ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>
                    Loading activity timeline...
                  </div>
                ) : timelineItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>
                    No recorded interactions yet. Send outreach or log a call to start timeline tracking.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {timelineItems.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          gap: '12px',
                          background: 'var(--bg-surface-elevated)',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          borderLeft: `3px solid ${item.type === 'call' ? 'var(--info)' : item.type === 'outreach' ? 'var(--gold-primary)' : item.type === 'note' ? 'var(--success)' : 'var(--border-subtle)'}`
                        }}
                      >
                        <div style={{ marginTop: '2px' }}>
                          {item.type === 'call' && <PhoneCall size={14} color="var(--info)" />}
                          {item.type === 'outreach' && <Send size={14} color="var(--gold-primary)" />}
                          {item.type === 'note' && <FileText size={14} color="var(--success)" />}
                          {item.type === 'followup' && <Clock size={14} color="var(--warning)" />}
                        </div>

                        <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--font-xs)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                              {item.title}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                              {new Date(item.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div style={{ color: 'var(--text-main)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                            {item.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Lead Notes */}
            {drawerTab === 'notes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Quick Add Note Form */}
                <form onSubmit={handleAddLeadNote} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Textarea
                    rows={3}
                    placeholder="Add a new quick note for this lead (markdown supported)..."
                    value={newLeadNoteText}
                    onChange={(e) => setNewLeadNoteText(e.target.value)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="primary" size="sm" loading={savingLeadNote} onClick={handleAddLeadNote}>
                      Save Note
                    </Button>
                  </div>
                </form>

                {/* Notes List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {leadNotes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>
                      No notes for this lead yet.
                    </div>
                  ) : (
                    leadNotes.map((note) => (
                      <div
                        key={note.id}
                        style={{
                          background: 'var(--bg-surface-elevated)',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: 'var(--font-xs)'
                        }}
                      >
                        <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-main)', lineHeight: 1.5, marginBottom: '6px' }}>
                          {note.body}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{new Date(note.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Mark Won Dialog (Item 8) */}
      {isWonModalOpen && wonLeadTarget && (
        <Modal
          isOpen={isWonModalOpen}
          onClose={() => setIsWonModalOpen(false)}
          title={`🎉 Deal Won: ${wonLeadTarget.businessName}`}
          size="sm"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Congratulations on closing this account! Optionally record the deal value to attribute won revenue to marketing channels and campaigns.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
              <Field label="Deal Value (Optional)">
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  value={wonDealValue}
                  onChange={(e) => setWonDealValue(e.target.value)}
                  placeholder="e.g. 35000"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--emerald-accent)',
                    fontWeight: 700,
                    fontSize: 'var(--font-sm)'
                  }}
                />
              </Field>

              <Field label="Currency">
                <input
                  type="text"
                  value={wonDealCurrency}
                  onChange={(e) => setWonDealCurrency(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-sm)'
                  }}
                />
              </Field>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleConfirmWonDeal(false)}
                disabled={savingWonDeal}
                title="Mark as Won without recording a value"
              >
                Skip (No Value)
              </Button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button type="button" variant="secondary" onClick={() => setIsWonModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  loading={savingWonDeal}
                  onClick={() => handleConfirmWonDeal(true)}
                >
                  Save Deal & Mark Won
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        loading={deletingLeads}
        title="Delete Selected Leads"
        message={`Are you sure you want to permanently delete ${selectedIds.size} selected leads from the database? This action cannot be undone.`}
        confirmText="Delete Leads"
      />
    </div>
  );
}
