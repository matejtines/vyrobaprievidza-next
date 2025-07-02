import React, { useState, useEffect, useRef } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { sk } from 'date-fns/locale';
import supabase from '../lib/supabase';
import ConfirmDialog from '../components/ConfirmDialog';
import { useUser } from '../context/UserContext';
import './SemaphorePage.css';

interface Employee {
  id: number | string;
  name: string;
  position?: string;
  zmena?: string;
  agentura?: boolean;
}

interface Norma {
  id: number;
  nazov: string;
  skratka: string;
  hodinova_norma?: number;
  zakazky?: {
    zakazka: {
      id: number;
      cislo_zakazky: string;
      nazov: string;
    };
    hodinova_norma: number;
  }[];
}

interface Vykon {
  id: number;
  norma_id: number;
  pocet_ks: number;
  pocet_hodin: number;
  norma: Norma;
  zaucanie: boolean;
  zaucanie_poznamka?: string;
  porucha: boolean;
  porucha_poznamka?: string;
  poznamka?: string;
  zakazka_id?: number;
  datum: string;
  employee_id: number | string;
  employee_type: string;
}

interface VykonModalState {
  isOpen: boolean;
  mode: 'add' | 'edit';
  vykon?: Vykon;
}

const SemaphorePage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [normy, setNormy] = useState<Norma[]>([]);
  const [vykony, setVykony] = useState<{[key: string]: Vykon[]}>({});
  const [selectedVykony, setSelectedVykony] = useState<Vykon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    employeeId: number | string;
    date: Date;
  } | null>(null);
  const [selectedNorma, setSelectedNorma] = useState<number | null>(null);
  const [pocetKs, setPocetKs] = useState<string>('');
  const [pocetHodin, setPocetHodin] = useState<string>('');
  const [zaucanie, setZaucanie] = useState(false);
  const [zaucaniePoznamka, setZaucaniePoznamka] = useState('');
  const [porucha, setPorucha] = useState(false);
  const [poruchaPoznamka, setPoruchaPoznamka] = useState('');
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsOperator, setStatsOperator] = useState<Employee | null>(null);
  const [stats, setStats] = useState({
    red: 0,
    green: 0,
    yellow: 0,
    orange: 0,
    bonus: 10
  });
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, key: string} | null>(null);
  const [contextMenuVykon, setContextMenuVykon] = useState<Vykon | null>(null);
  const ZMENY = ['A', 'C', 'D', 'O', 'A12', 'B12', 'C12', 'D12', 'VZZorman'];
  const [selectedZmena, setSelectedZmena] = useState('A');
  const [calendarVisible, setCalendarVisible] = useState(true);
  const [pendingZmena, setPendingZmena] = useState<string | null>(null);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [showGridSkeleton, setShowGridSkeleton] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const daysContainerRef = useRef<HTMLDivElement>(null);
  const headerDaysContainerRef = useRef<HTMLDivElement>(null);
  const employeeColumnRef = useRef<HTMLDivElement>(null);
  const scrollInterval = useRef<NodeJS.Timeout | null>(null);
  const [poznamka, setPoznamka] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [vykonToDelete, setVykonToDelete] = useState<Vykon | null>(null);
  const { user } = useUser();
  const [selectedZakazka, setSelectedZakazka] = useState<number | null>(null);
  const [availableZakazky, setAvailableZakazky] = useState<string[]>([]);
  const [vykonModal, setVykonModal] = useState<VykonModalState>({ isOpen: false, mode: 'add' });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingData, setPendingData] = useState<{
    employees?: Employee[];
    vykony?: {[key: string]: Vykon[]};
    zmena?: string;
    date?: Date;
  } | null>(null);

  useEffect(() => {
    fetchEmployees();
    fetchNormy();
  }, []);

  useEffect(() => {
    if (currentDate) {
      fetchVykony();
    }
  }, [currentDate]);

  useEffect(() => {
    if (pendingZmena !== null) {
      setSelectedZmena(pendingZmena);
      setPendingZmena(null);
    }
    if (pendingDate !== null) {
      setCurrentDate(pendingDate);
      setPendingDate(null);
    }
  }, [pendingZmena, pendingDate]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      let allEmployees = [];
      
      if (selectedZmena !== 'VZZorman') {
        const { data: regularEmployees, error: regularError } = await supabase
          .from('zamestnanci')
          .select('id, meno, zmena, angetura')
          .eq('zmena', selectedZmena)
          .order('meno');

        if (regularError) {
          throw new Error(`Chyba pri načítaní zamestnancov: ${regularError.message}`);
        }

        if (!regularEmployees) {
          throw new Error('Nepodarilo sa načítať zoznam zamestnancov');
        }

        allEmployees = regularEmployees.map(emp => ({
          id: emp.id,
          name: emp.meno,
          zmena: emp.zmena,
          agentura: emp.angetura
        }));
      } else {
        const { data: vzzormanEmployees, error: vzzormanError } = await supabase
          .from('vzzorman')
          .select('id, meno, pozicia')
          .order('pozicia, meno');

        if (vzzormanError) {
          throw new Error(`Chyba pri načítaní VZ Zorman zamestnancov: ${vzzormanError.message}`);
        }

        if (!vzzormanEmployees) {
          throw new Error('Nepodarilo sa načítať zoznam VZ Zorman zamestnancov');
        }

        allEmployees = vzzormanEmployees.map(emp => ({
          id: `vz-${emp.id}`,
          name: emp.meno,
          position: emp.pozicia
        }));
      }

      if (allEmployees.length === 0) {
        setError('Pre vybranú zmenu neboli nájdení žiadni zamestnanci');
      } else {
        setEmployees(allEmployees);
      }
    } catch (err: any) {
      console.error('Chyba pri načítaní zamestnancov:', err);
      setError(err.message || 'Nastala neočakávaná chyba pri načítaní zamestnancov');
    } finally {
      setLoading(false);
    }
  };

  const fetchNormy = async () => {
    try {
      setError(null);
      const { data, error } = await supabase
        .from('normy')
        .select(`
          *,
          zakazky:normy_zakazky(
            zakazka:zakazky(*),
            hodinova_norma
          )
        `)
        .order('nazov');

      if (error) {
        throw new Error(`Chyba pri načítaní noriem: ${error.message}`);
      }

      if (!data) {
        throw new Error('Nepodarilo sa načítať zoznam noriem');
      }
      
      // Transform data to match our interface
      const transformedData = data.map(norma => ({
        ...norma,
        zakazky: norma.zakazky?.map((nz: any) => ({
          zakazka: nz.zakazka,
          hodinova_norma: nz.hodinova_norma
        })) || []
      }));
      
      if (transformedData.length === 0) {
        setError('Neboli nájdené žiadne normy');
      } else {
        setNormy(transformedData);
      }
    } catch (err: any) {
      console.error('Chyba pri načítaní noriem:', err);
      setError(err.message || 'Nastala neočakávaná chyba pri načítaní noriem');
    }
  };

  const fetchVykony = async () => {
    try {
      setError(null);
      const startDate = startOfMonth(currentDate);
      const endDate = endOfMonth(currentDate);

      const { data, error } = await supabase
        .from('vykony')
        .select(`
          *,
          norma:normy(
            *,
            zakazky:normy_zakazky(
              zakazka:zakazky(*),
              hodinova_norma
            )
          )
        `)
        .gte('datum', format(startDate, 'yyyy-MM-dd'))
        .lte('datum', format(endDate, 'yyyy-MM-dd'));

      if (error) {
        throw new Error(`Chyba pri načítaní výkonov: ${error.message}`);
      }

      if (!data) {
        throw new Error('Nepodarilo sa načítať zoznam výkonov');
      }

      // Prevedieme pole na objekt pre rýchlejšie vyhľadávanie, kde každý kľúč obsahuje pole výkonov
      const vykonyMap: {[key: string]: Vykon[]} = {};
      data.forEach((vykon: any) => {
        if (!vykon.norma) {
          console.warn(`Výkon ID ${vykon.id} nemá priradenú normu`);
          return;
        }

        const key = `${vykon.employee_id}-${vykon.employee_type}-${vykon.datum}`;
        const vykonData: Vykon = {
          id: vykon.id,
          norma_id: vykon.norma_id,
          pocet_ks: vykon.pocet_ks,
          pocet_hodin: vykon.pocet_hodin,
          norma: {
            ...vykon.norma,
            zakazky: vykon.norma.zakazky?.map((nz: any) => ({
              zakazka: nz.zakazka,
              hodinova_norma: nz.hodinova_norma
            })) || []
          },
          zaucanie: vykon.zaucanie || false,
          zaucanie_poznamka: vykon.zaucanie_poznamka || '',
          porucha: vykon.porucha || false,
          porucha_poznamka: vykon.porucha_poznamka || '',
          poznamka: vykon.poznamka || '',
          zakazka_id: vykon.zakazka_id || null,
          datum: vykon.datum,
          employee_id: vykon.employee_id,
          employee_type: vykon.employee_type
        };

        if (!vykonyMap[key]) {
          vykonyMap[key] = [];
        }
        vykonyMap[key].push(vykonData);
      });

      setVykony(vykonyMap);
    } catch (err: any) {
      console.error('Chyba pri načítaní výkonov:', err);
      setError(err.message || 'Nastala neočakávaná chyba pri načítaní výkonov');
    }
  };

  const handleCellClick = (employeeId: number | string, date: Date) => {
    // Kontrola oprávnení pre správu výkonov - len admin, manager a timlider
    const canManageVykony = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'timlider';
    
    if (!canManageVykony) return;
    
    const key = `${employeeId}-${typeof employeeId === 'string' ? 'vzzorman' : 'zamestnanci'}-${format(date, 'yyyy-MM-dd')}`;
    const existingVykony = vykony[key] || [];
    
    setSelectedCell({ employeeId, date });
    setSelectedVykony(existingVykony);
    
    // Reset formulára
    setSelectedNorma(null);
    setPocetKs('');
    setPocetHodin('');
    setZaucanie(false);
    setZaucaniePoznamka('');
    setPorucha(false);
    setPoruchaPoznamka('');
    setPoznamka('');
    setSelectedZakazka(null);
    
    setVykonModal({ isOpen: true, mode: 'add' });
  };

  const handleEditVykon = (vykon: Vykon) => {
    setSelectedCell({
      employeeId: vykon.employee_id,
      date: new Date(vykon.datum)
    });
    setSelectedNorma(vykon.norma_id);
    setPocetKs(vykon.pocet_ks.toString());
    setPocetHodin(vykon.pocet_hodin.toString());
    setZaucanie(vykon.zaucanie);
    setZaucaniePoznamka(vykon.zaucanie_poznamka || '');
    setPorucha(vykon.porucha);
    setPoruchaPoznamka(vykon.porucha_poznamka || '');
    setPoznamka(vykon.poznamka || '');
    setSelectedZakazka(vykon.zakazka_id || null);
    setVykonModal({ isOpen: true, mode: 'edit', vykon });
  };

  const handleSaveVykon = async () => {
    if (!selectedCell || !selectedNorma || !pocetKs || !pocetHodin) {
      alert('Vyplňte všetky povinné polia');
      return;
    }

    // Validácia vstupov
    const ks = parseInt(pocetKs);
    const hodiny = parseFloat(pocetHodin);
    
    if (ks < 0) {
      alert('Počet kusov nemôže byť záporný');
      return;
    }
    
    if (hodiny <= 0 || hodiny > 24) {
      alert('Počet hodín musí byť medzi 0 a 24');
      return;
    }

    try {
      const employeeType = typeof selectedCell.employeeId === 'string' ? 'vzzorman' : 'zamestnanci';
      const employeeId = typeof selectedCell.employeeId === 'string' 
        ? parseInt(selectedCell.employeeId.split('-')[1]) 
        : selectedCell.employeeId;

      const selectedNormaData = normy.find(n => n.id === selectedNorma);
      if (!selectedNormaData) {
        throw new Error('Nepodarilo sa nájsť vybranú normu');
      }

      if (selectedNormaData.zakazky && selectedNormaData.zakazky.length > 0 && !selectedZakazka) {
        alert('Vyberte zákazku');
        return;
      }

      const key = `${selectedCell.employeeId}-${employeeType}-${format(selectedCell.date, 'yyyy-MM-dd')}`;
      const existingVykony = vykony[key] || [];

      // Kontrola duplicitného výkonu len pri pridávaní nového
      if (vykonModal.mode === 'add') {
        const isDuplicate = existingVykony.some(vykon => 
          vykon.norma_id === selectedNorma && 
          vykon.zakazka_id === selectedZakazka
        );

        if (isDuplicate) {
          alert('Tento výkon (norma + zákazka) už existuje pre tento deň. Vyberte inú normu alebo zákazku.');
          return;
        }
      }

      const vykonData = {
        employee_id: employeeId,
        employee_type: employeeType,
        norma_id: selectedNorma,
        pocet_ks: ks,
        pocet_hodin: hodiny,
        datum: format(selectedCell.date, 'yyyy-MM-dd'),
        zaucanie: zaucanie,
        zaucanie_poznamka: zaucaniePoznamka || '',
        porucha: porucha,
        porucha_poznamka: poruchaPoznamka || '',
        poznamka: poznamka || '',
        zakazka_id: selectedZakazka || null
      };

      let result;
      if (vykonModal.mode === 'edit' && vykonModal.vykon) {
        // Update existujúceho výkonu
        result = await supabase
          .from('vykony')
          .update(vykonData)
          .eq('id', vykonModal.vykon.id)
          .select();
      } else {
        // Pridanie nového výkonu
        result = await supabase
          .from('vykony')
          .insert([vykonData])
          .select();
      }

      if (result.error) {
        throw new Error(`Chyba pri ukladaní výkonu: ${result.error.message}`);
      }

      const savedVykon = result.data?.[0];
      if (!savedVykon) {
        throw new Error('Nepodarilo sa uložiť výkon');
      }

      const norma = normy.find(n => n.id === selectedNorma);
      if (!norma) {
        throw new Error('Nepodarilo sa nájsť normu pre uložený výkon');
      }

      const newVykon: Vykon = {
        ...savedVykon,
        norma: norma,
        datum: format(selectedCell.date, 'yyyy-MM-dd'),
        employee_id: employeeId,
        employee_type: employeeType
      };

      // Aktualizácia stavu
      if (vykonModal.mode === 'edit') {
        setVykony({
          ...vykony,
          [key]: existingVykony.map(v => v.id === newVykon.id ? newVykon : v)
        });
      } else {
        setVykony({
          ...vykony,
          [key]: [...existingVykony, newVykon]
        });
      }

      // Reset formulára
      setVykonModal({ isOpen: false, mode: 'add' });
      setSelectedNorma(null);
      setPocetKs('');
      setPocetHodin('');
      setZaucanie(false);
      setZaucaniePoznamka('');
      setPorucha(false);
      setPoruchaPoznamka('');
      setPoznamka('');
      setSelectedZakazka(null);
    } catch (err: any) {
      console.error('Chyba pri ukladaní výkonu:', err);
      alert(err.message || 'Nastala neočakávaná chyba pri ukladaní výkonu');
    }
  };

  const calculatePerformance = (vykon: Vykon) => {
    // Ak norma má zákazky, použijeme hodinovú normu z normy_zakazky
    if (vykon.norma.zakazky && vykon.norma.zakazky.length > 0 && vykon.zakazka_id) {
      const zakazkaNorma = vykon.norma.zakazky.find(z => z.zakazka.id === vykon.zakazka_id);
      if (zakazkaNorma) {
        const expectedKs = zakazkaNorma.hodinova_norma * vykon.pocet_hodin;
        return (vykon.pocet_ks / expectedKs * 100).toFixed(1);
      }
    }
    
    // Ak norma nemá zákazky, použijeme hodinovú normu z normy
    const expectedKs = (vykon.norma.hodinova_norma || 0) * vykon.pocet_hodin;
    return (vykon.pocet_ks / expectedKs * 100).toFixed(1);
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  const handlePrevMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const handleDeleteVykon = async () => {
    if (!selectedCell) {
      alert('Nie je vybraný žiadny výkon na vymazanie');
      return;
    }

    try {
      const employeeType = typeof selectedCell.employeeId === 'string' ? 'vzzorman' : 'zamestnanci';
      const employeeId = typeof selectedCell.employeeId === 'string' 
        ? parseInt(selectedCell.employeeId.split('-')[1]) 
        : selectedCell.employeeId;

      const key = `${selectedCell.employeeId}-${employeeType}-${format(selectedCell.date, 'yyyy-MM-dd')}`;
      const existingVykony = vykony[key] || [];

      if (existingVykony.length === 0) {
        throw new Error('Výkon nebol nájdený');
      }

      const { error } = await supabase
        .from('vykony')
        .delete()
        .eq('id', existingVykony[0].id)
        .eq('employee_id', employeeId)
        .eq('employee_type', employeeType)
        .eq('datum', format(selectedCell.date, 'yyyy-MM-dd'));

      if (error) {
        throw new Error(`Chyba pri mazaní výkonu: ${error.message}`);
      }

      // Vytvoríme nový objekt výkonov bez vymazaného výkonu
      const newVykony = { ...vykony };
      newVykony[key] = existingVykony.filter(v => v.id !== existingVykony[0].id);
      setVykony(newVykony);
      
      setShowModal(false);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error('Chyba pri mazaní výkonu:', err);
      alert(err.message || 'Nastala neočakávaná chyba pri mazaní výkonu');
    }
  };

  const getCellClassName = (vykon: Vykon) => {
    const performance = calculatePerformance(vykon);
    let className = 'vykon-cell';

    if (vykon.zaucanie) {
      className += ' zaucanie-cell';
    } else if (vykon.porucha) {
      className += ' porucha-cell';
    } else if (parseFloat(performance) >= 90) {
      className += ' good-performance';
    } else {
      className += ' bad-performance';
    }

    return className;
  };

  const calculateOperatorStats = (employee: Employee) => {
    if (!employee) {
      throw new Error('Nie je vybraný žiadny operátor');
    }

    const statsData = { red: 0, green: 0, yellow: 0, orange: 0 };
    
    daysInMonth.forEach(day => {
      const key = `${employee.id}-${typeof employee.id === 'string' ? 'vzzorman' : 'zamestnanci'}-${format(day, 'yyyy-MM-dd')}`;
      const vykonyForDay = vykony[key] || [];
      
      vykonyForDay.forEach(vykon => {
        if (vykon.zaucanie) {
          statsData.yellow++;
        } else if (vykon.porucha) {
          statsData.orange++;
        } else {
          const perf = parseFloat(calculatePerformance(vykon));
          if (perf >= 90) {
            statsData.green++;
          } else {
            statsData.red++;
          }
        }
      });
    });

    // Výpočet prémie
    let bonus = employee.id.toString().startsWith('vz-') ? 10 : 5;
    if (statsData.red >= 3 && statsData.red < 5) bonus -= 1;
    else if (statsData.red >= 5 && statsData.red < 8) bonus -= 2;
    else if (statsData.red >= 8 && statsData.red <= 8) bonus -= 3;
    else if (statsData.red > 8) bonus -= 5;

    return { ...statsData, bonus };
  };

  const handleOperatorClick = (employee: Employee) => {
    if (!employee) return;
    
    try {
      const stats = calculateOperatorStats(employee);
      setStatsOperator(employee);
      setStats(stats);
      setShowStatsModal(true);
    } catch (err: any) {
      console.error('Chyba pri výpočte štatistík:', err);
      alert(err.message || 'Nastala neočakávaná chyba pri výpočte štatistík');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    const vykonyForDay = vykony[key];
    if (vykonyForDay && vykonyForDay.length > 0) {
      setContextMenuVykon(vykonyForDay[0]); // Uložíme prvý výkon pre referenciu
      setContextMenu({ x: e.clientX, y: e.clientY, key });
    }
  };

  const handleDeleteVykonByKey = async (key: string, vykonId: number) => {
    try {
      const { error } = await supabase
        .from('vykony')
        .delete()
        .eq('id', vykonId);

      if (error) {
        throw new Error(`Chyba pri mazaní výkonu: ${error.message}`);
      }
      
      // Aktualizujeme stav - odstránime len konkrétny výkon
      const existingVykony = vykony[key] || [];
      const updatedVykony = existingVykony.filter(v => v.id !== vykonId);
      
      if (updatedVykony.length === 0) {
        const newVykony = { ...vykony };
        delete newVykony[key];
        setVykony(newVykony);
      } else {
        setVykony({
          ...vykony,
          [key]: updatedVykony
        });
      }
      
      setContextMenu(null);
      setContextMenuVykon(null);
    } catch (err: any) {
      console.error('Chyba pri mazaní výkonu:', err);
      alert(err.message || 'Nastala neočakávaná chyba pri mazaní výkonu');
      setContextMenu(null);
      setContextMenuVykon(null);
    }
  };

  useEffect(() => {
    const hideMenu = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', hideMenu);
      return () => window.removeEventListener('click', hideMenu);
    }
  }, [contextMenu]);

  const handleChangeZmena = async (zmena: string) => {
    if (isTransitioning || isLoading) return;
    
    setIsLoading(true);
    try {
      // Načítame nové dáta na pozadí
      const { data: regularEmployees, error: regularError } = await supabase
        .from('zamestnanci')
        .select('id, meno, zmena, angetura')
        .eq('zmena', zmena)
        .order('meno');

      if (regularError) throw regularError;

      const newEmployees = regularEmployees.map(emp => ({
        id: emp.id,
        name: emp.meno,
        zmena: emp.zmena,
        agentura: emp.angetura
      }));

      // Keď sú dáta načítané, spustíme animácie
      setIsTransitioning(true);
      setCalendarVisible(false);
      
      // Počkáme na fadeout (1s)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Aplikujeme nové dáta
      setEmployees(newEmployees);
      setSelectedZmena(zmena);
      
      // Spustíme fadein (1s)
      await new Promise(resolve => setTimeout(resolve, 50));
      setCalendarVisible(true);
      
      // Počkáme na dokončenie fadein
      setTimeout(() => {
        setIsTransitioning(false);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Chyba pri načítaní dát:', error);
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  const handlePrevMonthSafe = async () => {
    if (isTransitioning || isLoading) return;
    
    setIsLoading(true);
    try {
      const newDate = subMonths(currentDate, 1);
      const startDate = startOfMonth(newDate);
      const endDate = endOfMonth(newDate);

      // Načítame nové dáta na pozadí
      const { data, error } = await supabase
        .from('vykony')
        .select(`
          *,
          norma:normy(
            *,
            zakazky:normy_zakazky(
              zakazka:zakazky(*),
              hodinova_norma
            )
          )
        `)
        .gte('datum', format(startDate, 'yyyy-MM-dd'))
        .lte('datum', format(endDate, 'yyyy-MM-dd'));

      if (error) throw error;

      // Spracujeme nové výkony
      const vykonyMap: {[key: string]: Vykon[]} = {};
      data.forEach((vykon: any) => {
        if (!vykon.norma) return;
        const key = `${vykon.employee_id}-${vykon.employee_type}-${vykon.datum}`;
        const vykonData: Vykon = {
          id: vykon.id,
          norma_id: vykon.norma_id,
          pocet_ks: vykon.pocet_ks,
          pocet_hodin: vykon.pocet_hodin,
          norma: {
            ...vykon.norma,
            zakazky: vykon.norma.zakazky?.map((nz: any) => ({
              zakazka: nz.zakazka,
              hodinova_norma: nz.hodinova_norma
            })) || []
          },
          zaucanie: vykon.zaucanie || false,
          zaucanie_poznamka: vykon.zaucanie_poznamka || '',
          porucha: vykon.porucha || false,
          porucha_poznamka: vykon.porucha_poznamka || '',
          poznamka: vykon.poznamka || '',
          zakazka_id: vykon.zakazka_id || null,
          datum: vykon.datum,
          employee_id: vykon.employee_id,
          employee_type: vykon.employee_type
        };

        if (!vykonyMap[key]) {
          vykonyMap[key] = [];
        }
        vykonyMap[key].push(vykonData);
      });

      // Keď sú dáta načítané, spustíme animácie
      setIsTransitioning(true);
      setCalendarVisible(false);
      
      // Počkáme na fadeout (1s)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Aplikujeme nové dáta
      setVykony(vykonyMap);
      setCurrentDate(newDate);
      
      // Spustíme fadein (1s)
      await new Promise(resolve => setTimeout(resolve, 50));
      setCalendarVisible(true);
      
      // Počkáme na dokončenie fadein
      setTimeout(() => {
        setIsTransitioning(false);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Chyba pri načítaní dát:', error);
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  const handleNextMonthSafe = async () => {
    if (isTransitioning || isLoading) return;
    
    setIsLoading(true);
    try {
      const newDate = addMonths(currentDate, 1);
      const startDate = startOfMonth(newDate);
      const endDate = endOfMonth(newDate);

      // Načítame nové dáta na pozadí
      const { data, error } = await supabase
        .from('vykony')
        .select(`
          *,
          norma:normy(
            *,
            zakazky:normy_zakazky(
              zakazka:zakazky(*),
              hodinova_norma
            )
          )
        `)
        .gte('datum', format(startDate, 'yyyy-MM-dd'))
        .lte('datum', format(endDate, 'yyyy-MM-dd'));

      if (error) throw error;

      // Spracujeme nové výkony
      const vykonyMap: {[key: string]: Vykon[]} = {};
      data.forEach((vykon: any) => {
        if (!vykon.norma) return;
        const key = `${vykon.employee_id}-${vykon.employee_type}-${vykon.datum}`;
        const vykonData: Vykon = {
          id: vykon.id,
          norma_id: vykon.norma_id,
          pocet_ks: vykon.pocet_ks,
          pocet_hodin: vykon.pocet_hodin,
          norma: {
            ...vykon.norma,
            zakazky: vykon.norma.zakazky?.map((nz: any) => ({
              zakazka: nz.zakazka,
              hodinova_norma: nz.hodinova_norma
            })) || []
          },
          zaucanie: vykon.zaucanie || false,
          zaucanie_poznamka: vykon.zaucanie_poznamka || '',
          porucha: vykon.porucha || false,
          porucha_poznamka: vykon.porucha_poznamka || '',
          poznamka: vykon.poznamka || '',
          zakazka_id: vykon.zakazka_id || null,
          datum: vykon.datum,
          employee_id: vykon.employee_id,
          employee_type: vykon.employee_type
        };

        if (!vykonyMap[key]) {
          vykonyMap[key] = [];
        }
        vykonyMap[key].push(vykonData);
      });

      // Keď sú dáta načítané, spustíme animácie
      setIsTransitioning(true);
      setCalendarVisible(false);
      
      // Počkáme na fadeout (1s)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Aplikujeme nové dáta
      setVykony(vykonyMap);
      setCurrentDate(newDate);
      
      // Spustíme fadein (1s)
      await new Promise(resolve => setTimeout(resolve, 50));
      setCalendarVisible(true);
      
      // Počkáme na dokončenie fadein
      setTimeout(() => {
        setIsTransitioning(false);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Chyba pri načítaní dát:', error);
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!daysContainerRef.current || !headerDaysContainerRef.current) return;

    const container = daysContainerRef.current;
    const headerContainer = headerDaysContainerRef.current;
    const rect = container.getBoundingClientRect();
    const scrollSpeed = 5;
    const scrollThreshold = 50;

    // Zastavíme existujúce scrollovanie
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }

    // Kontrola horizontálneho scrollovania
    if (e.clientX < rect.left + scrollThreshold) {
      scrollInterval.current = setInterval(() => {
        container.scrollLeft -= scrollSpeed;
        headerContainer.scrollLeft = container.scrollLeft;
      }, 16);
    } else if (e.clientX > rect.right - scrollThreshold) {
      scrollInterval.current = setInterval(() => {
        container.scrollLeft += scrollSpeed;
        headerContainer.scrollLeft = container.scrollLeft;
      }, 16);
    }
  };

  const handleMouseLeave = () => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  };

  const handleScroll = () => {
    if (daysContainerRef.current && headerDaysContainerRef.current) {
      headerDaysContainerRef.current.scrollLeft = daysContainerRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    return () => {
      if (scrollInterval.current) {
        clearInterval(scrollInterval.current);
      }
    };
  }, []);

  const handleDeleteClick = (vykon: Vykon) => {
    setVykonToDelete(vykon);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!vykonToDelete) return;

    try {
      const key = Object.keys(vykony).find(k => vykony[k].some(v => v.id === vykonToDelete.id));
      if (key) {
        handleDeleteVykonByKey(key, vykonToDelete.id);
      }
      setShowDeleteConfirm(false);
      setVykonToDelete(null);
    } catch (error) {
      console.error('Chyba pri mazaní výkonu:', error);
      alert('Nepodarilo sa vymazať výkon');
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setVykonToDelete(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.preventDefault();
  };

  const handleNormaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const normaId = e.target.value ? parseInt(e.target.value) : null;
    setSelectedNorma(normaId);
    setSelectedZakazka(null);
  };

  const handleZakazkaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const zakazkaId = e.target.value ? parseInt(e.target.value) : null;
    setSelectedZakazka(zakazkaId);
  };

  if (error) {
    return (
      <div className="semaphore-page">
        <div className="error-container" style={{
          padding: '2rem',
          textAlign: 'center',
          background: 'var(--card-bg)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          margin: '2rem auto',
          maxWidth: '600px'
        }}>
          <h3 style={{ color: '#ef4444', marginBottom: '1rem' }}>Chyba</h3>
          <p style={{ color: 'var(--text-color)', marginBottom: '1.5rem' }}>{error}</p>
          <button 
            onClick={() => {
              setError(null);
              fetchEmployees();
              fetchNormy();
              fetchVykony();
            }}
            style={{
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.2s ease'
            }}
          >
            Skúsiť znova
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="semaphore-page">
        <div className="loading-container" style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-color)'
        }}>
          <div className="loading-spinner" style={{
            border: '4px solid var(--border-color)',
            borderTop: '4px solid var(--primary-color)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p>Načítavam dáta...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="semaphore-page">
      <div className="calendar-header" style={{ position: 'relative' }}>
        <button onClick={handlePrevMonthSafe} className="month-nav-button">
          &lt;
        </button>
        <h2>{format(currentDate, 'MMMM yyyy', { locale: sk })}</h2>
        <button onClick={handleNextMonthSafe} className="month-nav-button">
          &gt;
        </button>
      </div>

      <div className="zmena-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {ZMENY.map(zmena => (
          <button
            key={zmena}
            className={selectedZmena === zmena ? 'zmena-tab active' : 'zmena-tab'}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: 8,
              border: 'none',
              background: selectedZmena === zmena ? 'var(--primary-color)' : 'rgba(255,255,255,0.08)',
              color: selectedZmena === zmena ? 'white' : 'var(--text-color)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem',
              boxShadow: selectedZmena === zmena ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
              transition: 'all 0.2s',
            }}
            onClick={() => handleChangeZmena(zmena)}
          >
            {zmena}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        {/* Hlavička kalendára */}
        <div 
          className={`calendar-grid calendar-fade${calendarVisible ? ' show' : ''}`}
          style={{ 
            position: 'sticky',
            top: '64px',
            zIndex: 1000,
            backgroundColor: 'var(--background-color)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            pointerEvents: isTransitioning ? 'none' : 'auto'
          }}
        >
          <div className="employee-column" style={{ width: '200px', flexShrink: 0 }}>
            <div className="header-cell">Zamestnanci</div>
          </div>
          <div 
            className="days-columns" 
            ref={headerDaysContainerRef}
            style={{ 
              overflowX: 'hidden',
              overflowY: 'hidden',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              flex: 1,
            }}
          >
            <div className="days-header">
              {daysInMonth.map(day => (
                <div key={day.toISOString()} className="day-header">
                  {format(day, 'd')}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Obsah kalendára */}
        <div 
          className={`calendar-grid calendar-fade${calendarVisible ? ' show' : ''}`}
          style={{ 
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            pointerEvents: isTransitioning ? 'none' : 'auto'
          }}
        >
          <div 
            className="employee-column"
            ref={employeeColumnRef}
            style={{ 
              position: 'sticky',
              left: 0,
              backgroundColor: 'var(--background-color)',
              zIndex: 2,
              width: '200px',
              flexShrink: 0
            }}
          >
            {employees.map(employee => (
              <div
                key={employee.id}
                className={
                  'employee-cell' +
                  (employee.agentura ? ' agentura-employee' : '')
                }
                style={{ cursor: 'pointer' }}
                onClick={() => handleOperatorClick(employee)}
              >
                {employee.name}
                {employee.position && <span className="employee-position">({employee.position})</span>}
                {employee.agentura && <span className="agentura-badge">Agentúra</span>}
              </div>
            ))}
          </div>

          <div 
            className="days-columns"
            ref={daysContainerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onScroll={handleScroll}
            style={{ 
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              flex: 1,
            }}
          >
            {employees.map(employee => (
              <div key={employee.id} className="employee-row">
                {daysInMonth.map(day => {
                  const key = `${employee.id}-${typeof employee.id === 'string' ? 'vzzorman' : 'zamestnanci'}-${format(day, 'yyyy-MM-dd')}`;
                  const vykonyForDay = vykony[key] || [];
                  
                  let tooltipText = '';
                  if (vykonyForDay.length > 0) {
                    tooltipText = vykonyForDay.map(vykon => {
                      let text = `${vykon.norma.nazov}: ${calculatePerformance(vykon)}%`;
                      if (vykon.zaucanie && vykon.zaucanie_poznamka) {
                        text += `\nZaúčanie: ${vykon.zaucanie_poznamka}`;
                      }
                      if (vykon.porucha && vykon.porucha_poznamka) {
                        text += `\nPorucha/Oprava: ${vykon.porucha_poznamka}`;
                      }
                      if (vykon.poznamka) {
                        text += `\nPoznámka: ${vykon.poznamka}`;
                      }
                      return text;
                    }).join('\n\n');
                  }
                  
                  return (
                    <div 
                      key={`${employee.id}-${day.toISOString()}`} 
                      className="day-cell"
                      onClick={() => handleCellClick(employee.id, day)}
                      onContextMenu={vykonyForDay.length > 0 ? (e) => handleContextMenu(e, key) : undefined}
                      style={{
                        visibility: isLoading ? 'hidden' : 'visible'
                      }}
                    >
                      {vykonyForDay.length > 0 && (
                        <div className="vykony-container" style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${vykonyForDay.length}, 1fr)`,
                          gap: '1px',
                          height: '100%',
                          width: '100%',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0
                        }}>
                          {vykonyForDay.map((vykon, index) => (
                            <div 
                              key={vykon.id}
                              className={getCellClassName(vykon)}
                              title={tooltipText}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                padding: '2px',
                                fontSize: `${Math.max(0.5, Math.min(0.9, 1 - (vykonyForDay.length - 1) * 0.15))}rem`,
                                lineHeight: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                position: 'relative',
                                width: '100%',
                                height: '100%'
                              }}
                            >
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                                width: '100%',
                                justifyContent: 'center',
                                flexWrap: 'nowrap'
                              }}>
                                <span style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: vykonyForDay.length > 2 ? '80%' : '100%'
                                }}>
                                  {vykon.norma.skratka}
                                </span>
                                {(vykon.zaucanie || vykon.porucha) && (
                                  <div style={{
                                    display: 'flex',
                                    gap: '1px',
                                    fontSize: `${Math.max(0.5, Math.min(0.8, 0.9 - (vykonyForDay.length - 1) * 0.1))}em`,
                                    flexShrink: 0
                                  }}>
                                    {vykon.zaucanie && <span className="status-indicator zaucanie" style={{ padding: '0 2px' }}>Z</span>}
                                    {vykon.porucha && <span className="status-indicator porucha" style={{ padding: '0 2px' }}>P</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Kontextové menu */}
      {contextMenu &&
        (user?.role === 'admin' || user?.role === 'manager' || user?.role === 'timlider') && (
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              background: '#222',
              color: 'white',
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              zIndex: 9999,
              padding: '0.4rem 0',
              userSelect: 'none',
              minWidth: '180px',
              maxWidth: '250px',
              fontSize: '0.9rem'
            }}
            onContextMenu={e => e.preventDefault()}
          >
            <div
              style={{
                padding: '0.4rem 0.8rem',
                cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              onClick={() => {
                if (selectedCell) {
                  handleCellClick(selectedCell.employeeId, selectedCell.date);
                }
                setContextMenu(null);
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: '#4CAF50', fontSize: '1.1rem', minWidth: '1rem', textAlign: 'center' }}>+</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Pridať nový výkon</span>
            </div>
            {vykony[contextMenu.key]?.map(vykon => (
              <React.Fragment key={vykon.id}>
                <div
                  style={{
                    padding: '0.4rem 0.8rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#4CAF50',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  onClick={() => {
                    handleEditVykon(vykon);
                    setContextMenu(null);
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(76, 175, 80, 0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '1.1rem', minWidth: '1rem', textAlign: 'center' }}>✎</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Upraviť: {vykon.norma.skratka}
                  </span>
                </div>
                <div
                  style={{
                    padding: '0.4rem 0.8rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#f44336',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  onClick={() => {
                    setVykonToDelete(vykon);
                    setShowDeleteConfirm(true);
                    setContextMenu(null);
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(244, 67, 54, 0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '1.1rem', minWidth: '1rem', textAlign: 'center' }}>×</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Vymazať: {vykon.norma.skratka}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
        )
      }

      {/* Modálne okno pre pridanie/úpravu výkonu */}
      {vykonModal.isOpen && selectedCell && (
        <div className="vykon-modal-overlay" onClick={() => setVykonModal({ isOpen: false, mode: 'add' })}>
          <div className="vykon-modal-content" onClick={e => e.stopPropagation()}>
            <div className="vykon-modal-header">
              <h3>{vykonModal.mode === 'edit' ? 'Upraviť výkon' : 'Pridať výkon'}</h3>
              <button className="vykon-modal-close" onClick={() => setVykonModal({ isOpen: false, mode: 'add' })}>×</button>
            </div>
            <div className="vykon-modal-body">
              <div className="form-group">
                <label htmlFor="norma">Norma:</label>
                <select
                  id="norma"
                  value={selectedNorma || ''}
                  onChange={handleNormaChange}
                  required
                >
                  <option value="">Vyberte normu</option>
                  {normy.map((norma) => (
                    <option key={norma.id} value={norma.id}>
                      {norma.skratka} - {norma.nazov}
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const selectedNormaData = normy.find(n => n.id === selectedNorma);
                return selectedNorma && selectedNormaData?.zakazky && selectedNormaData.zakazky.length > 0 && (
                  <div className="form-group">
                    <label htmlFor="zakazka">Zákazka:</label>
                    <select
                      id="zakazka"
                      value={selectedZakazka || ''}
                      onChange={handleZakazkaChange}
                      required
                    >
                      <option value="">Vyberte zákazku</option>
                      {selectedNormaData.zakazky.map((nz) => (
                        <option key={nz.zakazka.id} value={nz.zakazka.id}>
                          {nz.zakazka.cislo_zakazky} - {nz.zakazka.nazov}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              <div className="vykon-form-group">
                <label>Počet kusov:</label>
                <input
                  type="number"
                  value={pocetKs}
                  onChange={e => setPocetKs(e.target.value)}
                  onWheel={handleWheel}
                  min="0"
                />
              </div>
              <div className="vykon-form-group">
                <label>Počet hodín:</label>
                <input
                  type="number"
                  value={pocetHodin}
                  onChange={e => setPocetHodin(e.target.value)}
                  onWheel={handleWheel}
                  min="0"
                  step="0.5"
                />
              </div>
              <div className="vykon-form-group">
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="zaucanie"
                    checked={zaucanie}
                    onChange={e => {
                      setZaucanie(e.target.checked);
                      if (!e.target.checked) {
                        setZaucaniePoznamka('');
                      }
                    }}
                  />
                  <label htmlFor="zaucanie">Zaúčanie</label>
                </div>
                {zaucanie && (
                  <input
                    type="text"
                    className="note-input"
                    placeholder="Zadajte poznámku k zaúčaniu..."
                    value={zaucaniePoznamka}
                    onChange={e => setZaucaniePoznamka(e.target.value)}
                  />
                )}
              </div>
              <div className="vykon-form-group">
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="porucha"
                    checked={porucha}
                    onChange={e => {
                      setPorucha(e.target.checked);
                      if (!e.target.checked) {
                        setPoruchaPoznamka('');
                      }
                    }}
                  />
                  <label htmlFor="porucha">Porucha/Oprava/Iné</label>
                </div>
                {porucha && (
                  <input
                    type="text"
                    className="note-input"
                    placeholder="Zadajte poznámku k poruche/oprave..."
                    value={poruchaPoznamka}
                    onChange={e => setPoruchaPoznamka(e.target.value)}
                  />
                )}
              </div>
              <div className="vykon-form-group">
                <label>Všeobecná poznámka:</label>
                <textarea
                  className="note-input"
                  placeholder="Zadajte všeobecnú poznámku..."
                  value={poznamka}
                  onChange={e => setPoznamka(e.target.value)}
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
              {selectedNorma && pocetKs && pocetHodin && (
                <div className="vykon-performance-preview">
                  <p>
                    <span>Očakávaný výkon:</span>
                    <span>
                      {(() => {
                        const selectedNormaData = normy.find(n => n.id === selectedNorma);
                        if (!selectedNormaData) return '0';
                        
                        if (selectedNormaData.zakazky && selectedNormaData.zakazky.length > 0 && selectedZakazka) {
                          const zakazkaNorma = selectedNormaData.zakazky.find(z => z.zakazka.id === selectedZakazka);
                          return zakazkaNorma ? (zakazkaNorma.hodinova_norma * parseFloat(pocetHodin)).toFixed(1) : '0';
                        }
                        
                        return ((selectedNormaData.hodinova_norma || 0) * parseFloat(pocetHodin)).toFixed(1);
                      })()} ks
                    </span>
                  </p>
                  <p>
                    <span>Skutočný výkon:</span>
                    <span>{pocetKs} ks</span>
                  </p>
                  <p>
                    <span>Percentuálny výkon:</span>
                    <span>
                      {(() => {
                        const selectedNormaData = normy.find(n => n.id === selectedNorma);
                        if (!selectedNormaData) return '0';
                        
                        if (selectedNormaData.zakazky && selectedNormaData.zakazky.length > 0 && selectedZakazka) {
                          const zakazkaNorma = selectedNormaData.zakazky.find(z => z.zakazka.id === selectedZakazka);
                          if (!zakazkaNorma) return '0';
                          return ((parseInt(pocetKs) / (zakazkaNorma.hodinova_norma * parseFloat(pocetHodin))) * 100).toFixed(1);
                        }
                        
                        return ((parseInt(pocetKs) / ((selectedNormaData.hodinova_norma || 0) * parseFloat(pocetHodin))) * 100).toFixed(1);
                      })()}%
                    </span>
                  </p>
                </div>
              )}
            </div>
            <div className="vykon-modal-footer">
              {vykonModal.mode === 'edit' && vykonModal.vykon && (
                <button 
                  onClick={() => {
                    if (vykonModal.vykon) {
                      setVykonToDelete(vykonModal.vykon);
                      setShowDeleteConfirm(true);
                    }
                  }} 
                  className="vykon-cancel-button"
                >
                  Vymazať výkon
                </button>
              )}
              <button onClick={() => setVykonModal({ isOpen: false, mode: 'add' })} className="vykon-cancel-button">
                Zrušiť
              </button>
              <button onClick={handleSaveVykon} className="vykon-save-button" style={{ backgroundColor: '#4CAF50' }}>
                {vykonModal.mode === 'edit' ? 'Uložiť zmeny' : 'Uložiť'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modálne okno so štatistikou */}
      {showStatsModal && statsOperator && (
        <div className="vykon-modal-overlay" onClick={() => setShowStatsModal(false)}>
          <div className="vykon-modal-content" onClick={e => e.stopPropagation()}>
            <div className="vykon-modal-header">
              <h3>Štatistika operátora: {statsOperator.name}</h3>
              <button className="vykon-modal-close" onClick={() => setShowStatsModal(false)}>×</button>
            </div>
            <div className="vykon-modal-body">
              <table style={{ width: '100%', marginBottom: '1.5rem', textAlign: 'center' }}>
                <thead>
                  <tr>
                    <th style={{ color: '#4CAF50' }}>Zelené dni</th>
                    <th style={{ color: '#f44336' }}>Červené dni</th>
                    <th style={{ color: '#ffeb3b' }}>Žlté dni</th>
                    <th style={{ color: '#ff9800' }}>Oranžové dni</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 'bold', color: '#4CAF50' }}>{stats.green}</td>
                    <td style={{ fontWeight: 'bold', color: '#f44336' }}>{stats.red}</td>
                    <td style={{ fontWeight: 'bold', color: '#ffeb3b' }}>{stats.yellow}</td>
                    <td style={{ fontWeight: 'bold', color: '#ff9800' }}>{stats.orange}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', textAlign: 'center' }}>
                Výsledná prémia za výkon: <span style={{ color: stats.bonus >= 5 ? '#4CAF50' : stats.bonus <= 0 ? '#f44336' : '#ff9800' }}>{stats.bonus}%</span>
              </div>
            </div>
            <div className="vykon-modal-footer">
              <button onClick={() => setShowStatsModal(false)} className="vykon-cancel-button">Zavrieť</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Vymazať výkon"
        message="Naozaj chcete vymazať tento výkon?"
        confirmText="Vymazať"
        cancelText="Zrušiť"
        onConfirm={() => {
          if (vykonToDelete) {
            const key = Object.keys(vykony).find(k => vykony[k].some(v => v.id === vykonToDelete.id));
            if (key) {
              handleDeleteVykonByKey(key, vykonToDelete.id);
            }
          }
          setShowDeleteConfirm(false);
          setVykonToDelete(null);
        }}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setVykonToDelete(null);
        }}
        type="danger"
      />
    </div>
  );
};

// Odstránim duplicitné definície animácií na konci súboru
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .calendar-fade {
    opacity: 1;
    transform: translateY(0);
    transition: all 1.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .calendar-fade:not(.show) {
    opacity: 0;
    transform: translateY(10px);
  }

  .day-cell {
    position: relative;
    min-height: 40px;
    border: 0.5px solid rgba(0, 0, 0, 0.1);
    border-left: 0.5px solid rgba(0, 0, 0, 0.1);
    border-right: 0.5px solid rgba(0, 0, 0, 0.1);
    padding: 0;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.03);
  }

  .day-cell:hover {
    border-color: var(--primary-color);
    background: rgba(255, 255, 255, 0.08);
  }

  .vykony-container {
    background: transparent;
  }

  .vykon-cell {
    display: flex;
    flex-direction: column;
    justify-content: center;
    alignItems: center;
    height: 100%;
    width: 100%;
    padding: 2px;
    border-radius: 2px;
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    border: 0.5px solid transparent;
  }

  .vykon-cell:hover {
    border-color: var(--primary-color);
  }

  .status-indicator {
    display: inline-flex;
    alignItems: center;
    justifyContent: center;
    min-width: 14px;
    height: 14px;
    border-radius: 2px;
    font-size: 0.7em;
    font-weight: bold;
  }

  .status-indicator.zaucanie {
    background-color: #ffeb3b;
    color: #000;
  }

  .status-indicator.porucha {
    background-color: #ff9800;
    color: #fff;
  }

  .good-performance {
    background-color: rgba(76, 175, 80, 0.12);
    border: 0.5px solid rgba(76, 175, 80, 0.15);
  }

  .bad-performance {
    background-color: rgba(244, 67, 54, 0.12);
    border: 0.5px solid rgba(244, 67, 54, 0.15);
  }

  .zaucanie-cell {
    background-color: rgba(255, 235, 59, 0.12);
    border: 0.5px solid rgba(255, 235, 59, 0.15);
  }

  .porucha-cell {
    background-color: rgba(255, 152, 0, 0.12);
    border: 0.5px solid rgba(255, 152, 0, 0.15);
  }

  .employee-row {
    display: flex;
    border-bottom: 0.5px solid rgba(0, 0, 0, 0.1);
  }

  .employee-row:last-child {
    border-bottom: none;
  }

  .days-header {
    display: flex;
    border-bottom: 0.5px solid rgba(0, 0, 0, 0.1);
  }

  .day-header {
    flex: 1;
    text-align: center;
    padding: 8px;
    font-weight: bold;
    border-right: 0.5px solid rgba(0, 0, 0, 0.1);
    background: rgba(255, 255, 255, 0.03);
  }

  .day-header:last-child {
    border-right: none;
  }

  .calendar-grid {
    background: rgba(255, 255, 255, 0.01);
  }
`;
document.head.appendChild(style);

export default SemaphorePage; 