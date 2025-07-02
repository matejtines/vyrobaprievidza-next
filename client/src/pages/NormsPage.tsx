import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ConfirmDialog from '../components/ConfirmDialog';
import { useUser } from '../context/UserContext';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import './NormsPage.css';

interface Zakazka {
  id: number;
  cislo_zakazky: string;
  nazov: string;
  popis?: string;
  isExpanded?: boolean;
}

interface NormaZakazka {
  zakazka: Zakazka;
  hodinova_norma: number;
}

interface Norma {
  id: number;
  nazov: string;
  skratka: string;
  created_at: string;
  hodinova_norma?: number;
  zakazky?: NormaZakazka[];
}

interface NormaZakazkaCheck {
  norma_id: number;
  normy: {
    nazov: string;
  };
}

interface VykonInfo {
  datum: string;
  zamestnanec: {
    meno: string;
  };
  pocet_ks: number;
  zmena: string;
}

interface SemaphoreVykonInfo {
  datum: string;
  zamestnanec_id: number;
  zamestnanci: {
    meno: string;
  };
  norma_id: number;
  normy: {
    nazov: string;
  };
  pocet_ks: number;
  zmena: string;
  pracovisko_id: number;
  pracoviska: {
    nazov: string;
  };
}

// Pridám SVG ikony ako komponenty
const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const CancelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const NormsPage: React.FC = () => {
  const { user } = useUser();
  const [normy, setNormy] = useState<Norma[]>([]);
  const [zakazky, setZakazky] = useState<Zakazka[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({
    nazov: '',
    skratka: '',
    hodinova_norma: '',
    selectedZakazky: [] as { id: number; hodinova_norma: string }[]
  });
  const [newNorma, setNewNorma] = useState({
    nazov: '',
    skratka: '',
    hodinova_norma: '',
    selectedZakazky: [] as { id: number; hodinova_norma: string }[]
  });
  const [showForm, setShowForm] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [normaToDelete, setNormaToDelete] = useState<number | null>(null);
  const [showZakazkaForm, setShowZakazkaForm] = useState(false);
  const [newZakazka, setNewZakazka] = useState({
    cislo_zakazky: '',
    nazov: '',
    popis: ''
  });
  const [showZakazky, setShowZakazky] = useState(false);
  const [editingZakazkaId, setEditingZakazkaId] = useState<number | null>(null);
  const [editZakazkaValues, setEditZakazkaValues] = useState({
    cislo_zakazky: '',
    nazov: '',
    popis: ''
  });
  const [zakazkaToDelete, setZakazkaToDelete] = useState<number | null>(null);
  const [showZakazkaDeleteConfirm, setShowZakazkaDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [expandedZakazky, setExpandedZakazky] = useState<{ [key: number]: boolean }>({});
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchNormy();
    fetchZakazky();
  }, []);

  const fetchZakazky = async () => {
    try {
      const { data, error } = await supabase
        .from('zakazky')
        .select('*')
        .order('cislo_zakazky');

      if (error) throw error;
      setZakazky(data || []);
    } catch (error) {
      console.error('Chyba pri načítaní zákaziek:', error);
    }
  };

  const fetchNormy = async () => {
    try {
      const { data, error } = await supabase
        .from('normy')
        .select(`
          *,
          zakazky:normy_zakazky(
            zakazka:zakazky(*),
            hodinova_norma
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to match our interface
      const transformedData = data?.map(norma => ({
        ...norma,
        zakazky: norma.zakazky?.map((nz: any) => ({
          zakazka: nz.zakazka,
          hodinova_norma: nz.hodinova_norma
        }))
      })) || [];
      
      setNormy(transformedData);
    } catch (error) {
      console.error('Chyba pri načítaní noriem:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateZakazka = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data, error } = await supabase
        .from('zakazky')
        .insert([{
          cislo_zakazky: newZakazka.cislo_zakazky.trim(),
          nazov: newZakazka.nazov.trim(),
          popis: newZakazka.popis.trim()
        }])
        .select();

      if (error) throw error;

      setZakazky([...(data || []), ...zakazky]);
      setNewZakazka({ cislo_zakazky: '', nazov: '', popis: '' });
      setShowZakazkaForm(false);
    } catch (error) {
      console.error('Chyba pri vytváraní zákazky:', error);
      alert('Nepodarilo sa vytvoriť zákazku');
    }
  };

  const handleSave = async (id: number) => {
    try {
      if (!editValues.nazov.trim()) {
        alert('Zadajte názov normy');
        return;
      }

      if (!editValues.skratka.trim()) {
        alert('Zadajte skratku normy');
        return;
      }

      if (!showZakazky && !editValues.hodinova_norma) {
        alert('Zadajte hodinovú normu');
        return;
      }

      if (showZakazky) {
        // Validate hodinova_norma for each zakazka
        for (const zakazka of editValues.selectedZakazky) {
          const hodinova_norma = parseFloat(zakazka.hodinova_norma);
          if (isNaN(hodinova_norma) || hodinova_norma < 0) {
            alert(`Zadajte platné číslo väčšie ako 0 pre zákazku ${zakazky.find(z => z.id === zakazka.id)?.cislo_zakazky}`);
            return;
          }
        }
      }

      // Update norma
      const { error: normaError } = await supabase
        .from('normy')
        .update({ 
          nazov: editValues.nazov.trim(),
          skratka: editValues.skratka.trim().toUpperCase(),
          hodinova_norma: showZakazky ? null : parseFloat(editValues.hodinova_norma)
        })
        .eq('id', id)
        .select();

      if (normaError) throw normaError;

      // Update zakazky relationships
      // First, delete existing relationships
      const { error: deleteError } = await supabase
        .from('normy_zakazky')
        .delete()
        .eq('norma_id', id);

      if (deleteError) throw deleteError;

      // Then, create new relationships
      if (showZakazky && editValues.selectedZakazky.length > 0) {
        const { error: insertError } = await supabase
          .from('normy_zakazky')
          .insert(
            editValues.selectedZakazky.map(zakazka => ({
              norma_id: id,
              zakazka_id: zakazka.id,
              hodinova_norma: parseFloat(zakazka.hodinova_norma)
            }))
          )
          .select();

        if (insertError) throw insertError;
      }

      await fetchNormy();
      setEditingId(null);
      setShowZakazky(false);
    } catch (error) {
      console.error('Chyba pri ukladaní normy:', error);
      alert('Nepodarilo sa uložiť normu');
    }
  };

  const handleCreateNorma = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!newNorma.nazov.trim()) {
        alert('Zadajte názov normy');
        return;
      }

      if (!newNorma.skratka.trim()) {
        alert('Zadajte skratku normy');
        return;
      }

      if (!showZakazky && !newNorma.hodinova_norma) {
        alert('Zadajte hodinovú normu');
        return;
      }

      if (showZakazky) {
        // Validate hodinova_norma for each zakazka
        for (const zakazka of newNorma.selectedZakazky) {
          const hodinova_norma = parseFloat(zakazka.hodinova_norma);
          if (isNaN(hodinova_norma) || hodinova_norma < 0) {
            alert(`Zadajte platné číslo väčšie ako 0 pre zákazku ${zakazky.find(z => z.id === zakazka.id)?.cislo_zakazky}`);
            return;
          }
        }
      }

      // Create norma
      const { data: normaData, error: normaError } = await supabase
        .from('normy')
        .insert([{ 
          nazov: newNorma.nazov.trim(),
          skratka: newNorma.skratka.trim().toUpperCase(),
          hodinova_norma: showZakazky ? null : parseFloat(newNorma.hodinova_norma)
        }])
        .select();

      if (normaError) throw normaError;

      // Create zakazky relationships
      if (showZakazky && newNorma.selectedZakazky.length > 0 && normaData?.[0]) {
        const { error: zakazkyError } = await supabase
          .from('normy_zakazky')
          .insert(
            newNorma.selectedZakazky.map(zakazka => ({
              norma_id: normaData[0].id,
              zakazka_id: zakazka.id,
              hodinova_norma: parseFloat(zakazka.hodinova_norma)
            }))
          )
          .select();

        if (zakazkyError) throw zakazkyError;
      }

      await fetchNormy();
      setNewNorma({ nazov: '', skratka: '', hodinova_norma: '', selectedZakazky: [] });
      setShowForm(false);
      setShowZakazky(false);
    } catch (error) {
      console.error('Chyba pri vytváraní normy:', error);
      alert('Nepodarilo sa vytvoriť normu');
    }
  };

  const handleEdit = (norma: Norma) => {
    setEditingId(norma.id);
    setEditValues({
      nazov: norma.nazov,
      skratka: norma.skratka,
      hodinova_norma: norma.hodinova_norma?.toString() || '',
      selectedZakazky: norma.zakazky?.map(z => ({
        id: z.zakazka.id,
        hodinova_norma: z.hodinova_norma.toString()
      })) || []
    });
    setShowZakazky(Boolean(norma.zakazky && norma.zakazky.length > 0));
  };

  const handleDelete = async (id: number) => {
    setNormaToDelete(id);
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!normaToDelete) return;

    try {
      // Najprv vymažeme všetky výkony používajúce túto normu
      const { error: vykonyError } = await supabase
        .from('vykony')
        .delete()
        .eq('norma_id', normaToDelete);

      if (vykonyError) throw vykonyError;

      // Potom vymažeme samotnú normu
      const { error: normaError } = await supabase
        .from('normy')
        .delete()
        .eq('id', normaToDelete);

      if (normaError) throw normaError;

      setNormy(normy.filter(n => n.id !== normaToDelete));
      setShowConfirmDialog(false);
      setNormaToDelete(null);
    } catch (error) {
      console.error('Chyba pri mazaní normy:', error);
      alert('Nepodarilo sa vymazať normu. Skontrolujte, či norma nie je používaná v existujúcich výkonoch.');
    }
  };

  const handleCancelDelete = () => {
    setShowConfirmDialog(false);
    setNormaToDelete(null);
  };

  const calculateNorm = (hourlyNorm: number, hours: number) => {
    return (hourlyNorm * hours).toFixed(2);
  };

  const handleEditZakazka = (zakazka: Zakazka) => {
    setEditingZakazkaId(zakazka.id);
    setEditZakazkaValues({
      cislo_zakazky: zakazka.cislo_zakazky,
      nazov: zakazka.nazov,
      popis: zakazka.popis || ''
    });
  };

  const handleSaveZakazka = async (id: number) => {
    try {
      if (!editZakazkaValues.cislo_zakazky.trim()) {
        alert('Zadajte číslo zákazky');
        return;
      }

      if (!editZakazkaValues.nazov.trim()) {
        alert('Zadajte názov zákazky');
        return;
      }

      // Kontrola duplicity čísla zákazky
      const { data: existingZakazky } = await supabase
        .from('zakazky')
        .select('id, cislo_zakazky')
        .eq('cislo_zakazky', editZakazkaValues.cislo_zakazky.trim())
        .neq('id', id);

      if (existingZakazky && existingZakazky.length > 0) {
        alert('Zákazka s týmto číslom už existuje');
        return;
      }

      const { error } = await supabase
        .from('zakazky')
        .update({
          cislo_zakazky: editZakazkaValues.cislo_zakazky.trim(),
          nazov: editZakazkaValues.nazov.trim(),
          popis: editZakazkaValues.popis.trim()
        })
        .eq('id', id);

      if (error) throw error;

      await fetchZakazky();
      setEditingZakazkaId(null);
    } catch (error) {
      console.error('Chyba pri ukladaní zákazky:', error);
      alert('Nepodarilo sa uložiť zákazku');
    }
  };

  const handleDeleteZakazka = async (id: number) => {
    setZakazkaToDelete(id);
    setShowZakazkaDeleteConfirm(true);
  };

  const handleConfirmDeleteZakazka = async () => {
    if (!zakazkaToDelete) return;

    try {
      // Najprv skontrolujeme, či zákazka nie je používaná v normách
      const { data: normyZakazky, error: checkError } = await supabase
        .from('normy_zakazky')
        .select('norma_id, normy(nazov)')
        .eq('zakazka_id', zakazkaToDelete) as { data: NormaZakazkaCheck[] | null, error: any };

      if (checkError) {
        console.error('Chyba pri kontrole použitia zákazky:', checkError);
        setErrorMessage('Nastala chyba pri kontrole použitia zákazky. Skúste to znova.');
        setShowErrorDialog(true);
        return;
      }

      // Ak je zákazka používaná v normách, skontrolujeme semafor
      if (normyZakazky && normyZakazky.length > 0) {
        const normaIds = normyZakazky.map(nz => nz.norma_id);
        
        // Jednoduchá kontrola semaforu
        const { data: semaphoreCheck } = await supabase
          .from('semaphore_vykony')
          .select('id')
          .in('norma_id', normaIds)
          .limit(1);

        const normyList = normyZakazky.map(nz => nz.normy.nazov).join(', ');
        let errorMessage = `Zákazku nie je možné vymazať, pretože je používaná v nasledujúcich normách: ${normyList}`;

        // Ak existujú výkony zo semaforu, pridáme jednoduchú hlášku
        if (semaphoreCheck && semaphoreCheck.length > 0) {
          errorMessage += '\n\nZákazka je používaná v semafore.';
        }

        setErrorMessage(errorMessage);
        setShowErrorDialog(true);
        setShowZakazkaDeleteConfirm(false);
        setZakazkaToDelete(null);
        return;
      }

      // Ak zákazka nie je používaná, môžeme ju vymazať
      const { error: deleteError } = await supabase
        .from('zakazky')
        .delete()
        .eq('id', zakazkaToDelete);

      if (deleteError) {
        console.error('Chyba pri mazaní zákazky:', deleteError);
        setErrorMessage('Nastala chyba pri mazaní zákazky. Skúste to znova.');
        setShowErrorDialog(true);
        return;
      }

      // Aktualizujeme zoznam zákaziek
      setZakazky(prevZakazky => prevZakazky.filter(z => z.id !== zakazkaToDelete));
      setShowZakazkaDeleteConfirm(false);
      setZakazkaToDelete(null);
    } catch (error: any) {
      console.error('Chyba pri mazaní zákazky:', error);
      setErrorMessage('Nastala neočakávaná chyba. Skúste to znova.');
      setShowErrorDialog(true);
    }
  };

  const handleCancelDeleteZakazka = () => {
    setShowZakazkaDeleteConfirm(false);
    setZakazkaToDelete(null);
  };

  const toggleZakazka = (zakazkaId: number) => {
    setExpandedZakazky(prev => ({
      ...prev,
      [zakazkaId]: !prev[zakazkaId]
    }));
  };

  const handleCloseErrorDialog = () => {
    setShowErrorDialog(false);
    setErrorMessage('');
  };

  return (
    <div className="norms-page">
      <h1>Hodinové normy a zákazky</h1>

      <Tabs selectedIndex={activeTab} onSelect={(index: number) => setActiveTab(index)}>
        <TabList>
          <Tab>Hodinové normy</Tab>
          <Tab>Zákazky</Tab>
        </TabList>

        <TabPanel>
          <div className="tab-content">
            <div className="actions-bar">
              <button 
                className="add-button"
                onClick={() => {
                  setShowForm(!showForm);
                  if (!showForm) {
                    setNewNorma({ nazov: '', skratka: '', hodinova_norma: '', selectedZakazky: [] });
                    setShowZakazky(false);
                  }
                }}
              >
                {showForm ? '❌ Zrušiť' : '➕ Pridať novú normu'}
              </button>
            </div>

            {showForm && (
              <div className="form-card">
                <h3>Nová norma</h3>
                <form onSubmit={handleCreateNorma} className="norma-form">
                  <div className="form-group">
                    <label htmlFor="nazov">Názov normy:</label>
                    <input
                      type="text"
                      id="nazov"
                      value={newNorma.nazov}
                      onChange={(e) => setNewNorma({ ...newNorma, nazov: e.target.value })}
                      placeholder="Zadajte názov normy"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="skratka">Skratka normy:</label>
                    <input
                      type="text"
                      id="skratka"
                      value={newNorma.skratka}
                      onChange={(e) => setNewNorma({ ...newNorma, skratka: e.target.value })}
                      placeholder="Zadajte skratku normy"
                      maxLength={10}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={showZakazky}
                        onChange={(e) => setShowZakazky(e.target.checked)}
                      />
                      Norma so zákazkami
                    </label>
                  </div>
                  {!showZakazky ? (
                    <div className="form-group">
                      <label htmlFor="hodinova_norma">Hodinová norma:</label>
                      <input
                        type="number"
                        id="hodinova_norma"
                        value={newNorma.hodinova_norma}
                        onChange={(e) => setNewNorma({ ...newNorma, hodinova_norma: e.target.value })}
                        placeholder="Zadajte hodinovú normu"
                        min="0"
                        step="1"
                        required
                      />
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>Zákazky a hodinové normy:</label>
                      <div className="zakazky-list">
                        {zakazky.map(zakazka => (
                          <div key={zakazka.id} className="zakazka-item">
                            <label>
                              <input
                                type="checkbox"
                                checked={newNorma.selectedZakazky.some(z => z.id === zakazka.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewNorma({
                                      ...newNorma,
                                      selectedZakazky: [
                                        ...newNorma.selectedZakazky,
                                        { id: zakazka.id, hodinova_norma: '' }
                                      ]
                                    });
                                  } else {
                                    setNewNorma({
                                      ...newNorma,
                                      selectedZakazky: newNorma.selectedZakazky.filter(z => z.id !== zakazka.id)
                                    });
                                  }
                                }}
                              />
                              {zakazka.cislo_zakazky} - {zakazka.nazov}
                            </label>
                            {newNorma.selectedZakazky.some(z => z.id === zakazka.id) && (
                              <div className="zakazka-norma">
                                <input
                                  type="number"
                                  value={newNorma.selectedZakazky.find(z => z.id === zakazka.id)?.hodinova_norma || ''}
                                  onChange={(e) => {
                                    setNewNorma({
                                      ...newNorma,
                                      selectedZakazky: newNorma.selectedZakazky.map(z =>
                                        z.id === zakazka.id
                                          ? { ...z, hodinova_norma: e.target.value }
                                          : z
                                      )
                                    });
                                  }}
                                  placeholder="Hodinová norma"
                                  min="0"
                                  step="1"
                                  required
                                />
                                <span className="norma-info">ks/h</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button type="submit" className="submit-button">
                    Vytvoriť normu
                  </button>
                </form>
              </div>
            )}

            {loading ? (
              <div className="loading">Načítavam...</div>
            ) : (
              <div className="norms-grid">
                {normy.map((norma) => (
                  <div key={norma.id} className="norma-card">
                    <div className="norma-card-header">
                      <h3>{norma.nazov}</h3>
                      <span className="norma-skratka">{norma.skratka}</span>
                      {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'timlider') && (
                        <div className="card-actions">
                          <button
                            className="icon-button edit"
                            onClick={() => handleEdit(norma)}
                            title="Upraviť normu"
                          >
                            <EditIcon />
                          </button>
                          <button
                            className="icon-button delete"
                            onClick={() => handleDelete(norma.id)}
                            title="Vymazať normu"
                          >
                            <DeleteIcon />
                          </button>
                        </div>
                      )}
                    </div>

                    {editingId === norma.id ? (
                      <div className="edit-form">
                        <div className="form-group">
                          <label htmlFor="nazov">Názov normy:</label>
                          <input
                            type="text"
                            value={editValues.nazov}
                            onChange={(e) => setEditValues({ ...editValues, nazov: e.target.value })}
                            className="edit-input"
                            placeholder="Názov normy"
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="skratka">Skratka normy:</label>
                          <input
                            type="text"
                            value={editValues.skratka}
                            onChange={(e) => setEditValues({ ...editValues, skratka: e.target.value })}
                            className="edit-input"
                            placeholder="Skratka"
                            maxLength={10}
                          />
                        </div>
                        <div className="form-group">
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={showZakazky}
                              onChange={(e) => setShowZakazky(e.target.checked)}
                            />
                            Norma so zákazkami
                          </label>
                        </div>
                        {!showZakazky ? (
                          <div className="form-group">
                            <input
                              type="number"
                              value={editValues.hodinova_norma}
                              onChange={(e) => setEditValues({ ...editValues, hodinova_norma: e.target.value })}
                              placeholder="Hodinová norma"
                              min="0"
                              step="1"
                              required
                            />
                          </div>
                        ) : (
                          <div className="zakazky-list">
                            {zakazky.map(zakazka => (
                              <div key={zakazka.id} className="zakazka-item">
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={editValues.selectedZakazky.some(z => z.id === zakazka.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setEditValues({
                                          ...editValues,
                                          selectedZakazky: [
                                            ...editValues.selectedZakazky,
                                            { id: zakazka.id, hodinova_norma: '' }
                                          ]
                                        });
                                      } else {
                                        setEditValues({
                                          ...editValues,
                                          selectedZakazky: editValues.selectedZakazky.filter(z => z.id !== zakazka.id)
                                        });
                                      }
                                    }}
                                  />
                                  {zakazka.cislo_zakazky} - {zakazka.nazov}
                                </label>
                                {editValues.selectedZakazky.some(z => z.id === zakazka.id) && (
                                  <div className="zakazka-norma">
                                    <input
                                      type="number"
                                      value={editValues.selectedZakazky.find(z => z.id === zakazka.id)?.hodinova_norma || ''}
                                      onChange={(e) => {
                                        setEditValues({
                                          ...editValues,
                                          selectedZakazky: editValues.selectedZakazky.map(z =>
                                            z.id === zakazka.id
                                              ? { ...z, hodinova_norma: e.target.value }
                                              : z
                                          )
                                        });
                                      }}
                                      placeholder="Hodinová norma"
                                      min="0"
                                      step="1"
                                      required
                                    />
                                    <span className="norma-info">ks/h</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="edit-buttons">
                          <button
                            className="save-button"
                            onClick={() => handleSave(norma.id)}
                          >
                            Uložiť
                          </button>
                          <button
                            className="cancel-button"
                            onClick={() => {
                              setEditingId(null);
                              setShowZakazky(false);
                            }}
                          >
                            Zrušiť
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="norma-details">
                        {norma.zakazky && norma.zakazky.length > 0 ? (
                          <div className="zakazky-grid">
                            {norma.zakazky.map(zakazka => (
                              <div key={zakazka.zakazka.id} className="zakazka-tag">
                                <div 
                                  className="zakazka-header"
                                  onClick={() => toggleZakazka(zakazka.zakazka.id)}
                                >
                                  <div className="zakazka-header-content">
                                    <span className="zakazka-number">{zakazka.zakazka.cislo_zakazky}</span>
                                    <span className="zakazka-norma">{zakazka.hodinova_norma} ks/h</span>
                                  </div>
                                  <span className={`collapse-icon ${expandedZakazky[zakazka.zakazka.id] ? 'expanded' : ''}`}>
                                    ▼
                                  </span>
                                </div>
                                <div className={`zakazka-details ${expandedZakazky[zakazka.zakazka.id] ? 'expanded' : ''}`}>
                                  <div className="norma-calculations">
                                    <div className="calculation">
                                      <span className="hours">7.5h</span>
                                      <span className="ks">{calculateNorm(zakazka.hodinova_norma, 7.5)} ks</span>
                                    </div>
                                    <div className="calculation">
                                      <span className="hours">11.5h</span>
                                      <span className="ks">{calculateNorm(zakazka.hodinova_norma, 11.5)} ks</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="single-norma">
                            <div className="norma-value">{norma.hodinova_norma} ks/h</div>
                            <div className="norma-calculations">
                              <div className="calculation">
                                <span className="hours">7.5h</span>
                                <span className="ks">{calculateNorm(norma.hodinova_norma || 0, 7.5)} ks</span>
                              </div>
                              <div className="calculation">
                                <span className="hours">11.5h</span>
                                <span className="ks">{calculateNorm(norma.hodinova_norma || 0, 11.5)} ks</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabPanel>

        <TabPanel>
          <div className="tab-content">
            <div className="actions-bar">
              <button 
                className="add-button"
                onClick={() => {
                  setShowZakazkaForm(!showZakazkaForm);
                  if (!showZakazkaForm) {
                    setNewZakazka({ cislo_zakazky: '', nazov: '', popis: '' });
                  }
                }}
              >
                {showZakazkaForm ? '❌ Zrušiť' : '➕ Pridať novú zákazku'}
              </button>
            </div>

            {showZakazkaForm && (
              <div className="form-card">
                <h3>Nová zákazka</h3>
                <form onSubmit={handleCreateZakazka} className="zakazka-form">
                  <div className="form-group">
                    <label htmlFor="cislo_zakazky">Číslo zákazky:</label>
                    <input
                      type="text"
                      id="cislo_zakazky"
                      value={newZakazka.cislo_zakazky}
                      onChange={(e) => setNewZakazka({ ...newZakazka, cislo_zakazky: e.target.value })}
                      placeholder="Zadajte číslo zákazky"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="nazov">Názov zákazky:</label>
                    <input
                      type="text"
                      id="nazov"
                      value={newZakazka.nazov}
                      onChange={(e) => setNewZakazka({ ...newZakazka, nazov: e.target.value })}
                      placeholder="Zadajte názov zákazky"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="popis">Popis:</label>
                    <textarea
                      id="popis"
                      value={newZakazka.popis}
                      onChange={(e) => setNewZakazka({ ...newZakazka, popis: e.target.value })}
                      placeholder="Zadajte popis zákazky"
                    />
                  </div>
                  <button type="submit" className="submit-button">
                    Vytvoriť zákazku
                  </button>
                </form>
              </div>
            )}

            <div className="zakazky-grid">
              {zakazky.map((zakazka) => (
                <div key={zakazka.id} className="zakazka-card">
                  <div className="zakazka-card-header">
                    <div className="zakazka-title">
                      <span className="zakazka-number">{zakazka.cislo_zakazky}</span>
                      <h3>{zakazka.nazov}</h3>
                    </div>
                    {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'timlider') && (
                      <div className="card-actions">
                        {editingZakazkaId === zakazka.id ? (
                          <>
                            <button
                              className="icon-button save"
                              onClick={() => handleSaveZakazka(zakazka.id)}
                              title="Uložiť zákazku"
                            >
                              <SaveIcon />
                            </button>
                            <button
                              className="icon-button cancel"
                              onClick={() => setEditingZakazkaId(null)}
                              title="Zrušiť úpravu"
                            >
                              <CancelIcon />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="icon-button edit"
                              onClick={() => handleEditZakazka(zakazka)}
                              title="Upraviť zákazku"
                            >
                              <EditIcon />
                            </button>
                            <button
                              className="icon-button delete"
                              onClick={() => handleDeleteZakazka(zakazka.id)}
                              title="Vymazať zákazku"
                            >
                              <DeleteIcon />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {editingZakazkaId === zakazka.id ? (
                    <div className="edit-form">
                      <input
                        type="text"
                        value={editZakazkaValues.cislo_zakazky}
                        onChange={(e) => setEditZakazkaValues({ ...editZakazkaValues, cislo_zakazky: e.target.value })}
                        className="edit-input"
                        placeholder="Číslo zákazky"
                      />
                      <input
                        type="text"
                        value={editZakazkaValues.nazov}
                        onChange={(e) => setEditZakazkaValues({ ...editZakazkaValues, nazov: e.target.value })}
                        className="edit-input"
                        placeholder="Názov zákazky"
                      />
                      <textarea
                        value={editZakazkaValues.popis}
                        onChange={(e) => setEditZakazkaValues({ ...editZakazkaValues, popis: e.target.value })}
                        className="edit-input"
                        placeholder="Popis zákazky"
                        rows={2}
                      />
                    </div>
                  ) : (
                    <div className="zakazka-details">
                      {zakazka.popis && <p className="zakazka-description">{zakazka.popis}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabPanel>
      </Tabs>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="Vymazať normu"
        message="Naozaj chcete vymazať túto normu? Táto akcia vymaže aj všetky výkony používajúce túto normu."
        confirmText="Vymazať"
        cancelText="Zrušiť"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        type="danger"
      />

      <ConfirmDialog
        isOpen={showZakazkaDeleteConfirm}
        title="Vymazať zákazku"
        message="Naozaj chcete vymazať túto zákazku? Táto akcia je nezvratná."
        confirmText="Vymazať"
        cancelText="Zrušiť"
        onConfirm={handleConfirmDeleteZakazka}
        onCancel={handleCancelDeleteZakazka}
        type="danger"
      />

      <ConfirmDialog
        isOpen={showErrorDialog}
        title="Chyba"
        message={errorMessage}
        confirmText="Rozumiem"
        onConfirm={handleCloseErrorDialog}
        onCancel={handleCloseErrorDialog}
        type="info"
      />
    </div>
  );
};

export default NormsPage; 