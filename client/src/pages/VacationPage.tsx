import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import DatePicker, { registerLocale } from 'react-datepicker';
import { sk } from 'date-fns/locale';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, differenceInDays } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';
import './VacationPage.css';
import { FaBan } from 'react-icons/fa';
import ConfirmDialog from '../components/ConfirmDialog';
import { useUser } from '../context/UserContext';

registerLocale('sk', sk);

interface Employee {
  id: string;
  meno: string;
  celkova_dovolenka?: number;
  pozicia?: string;  // pre VZ a zoraďovačov
  zmena?: string;
}

interface Absence {
  id: number;
  employee_id: number;
  employee_type: string;
  typ_absencie: 'dovolenka' | 'pn' | '§' | 'LS' | 'neratat';
  datum_od: string;
  datum_do: string;
  poznamka?: string;
}

interface EmployeeStats {
  celkova_dovolenka: number;
  vycerpana_dovolenka: number;
  zostava_dovolenka: number;
  celkove_paragrafy: number;
  vycerpane_paragrafy: number;
  zostava_paragrafy: number;
  celkove_ls: number;
  vycerpane_ls: number;
  zostava_ls: number;
}

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface Vacation {
  id: number;
  employee_id: number;
  employee_name: string;
  start_date: string;
  end_date: string;
  type: string;
  approved: boolean;
}

const VacationPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedType, setSelectedType] = useState<'dovolenka' | 'pn' | '§' | 'LS' | 'neratat' | null>(null);
  const [viewMode, setViewMode] = useState<'operators' | 'vzzorman'>('operators');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAddingAbsence, setIsAddingAbsence] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ position: ContextMenuPosition; absence: Absence } | null>(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState<string | null>(null);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingAbsence, setPendingAbsence] = useState<{
    employeeId: string;
    start: Date;
    end: Date;
    type: 'dovolenka' | 'pn' | '§' | 'LS' | 'neratat';
    poznamka?: string;
  } | null>(null);
  const [hoverEndDate, setHoverEndDate] = useState<Date | null>(null);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats | null>(null);
  const [isEditingTotal, setIsEditingTotal] = useState(false);
  const [newTotal, setNewTotal] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [vacationToDelete, setVacationToDelete] = useState<Vacation | null>(null);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [showTypeWarning, setShowTypeWarning] = useState(false);
  const [absenceToDelete, setAbsenceToDelete] = useState<Absence | null>(null);
  const [showAbsenceDeleteConfirm, setShowAbsenceDeleteConfirm] = useState(false);
  const [absenceNote, setAbsenceNote] = useState('');
  const [availableShifts, setAvailableShifts] = useState<{
    'Štandardné zmeny': string[],
    '12-hodinové zmeny': string[],
    'Špeciálne zmeny': string[]
  }>({
    'Štandardné zmeny': [],
    '12-hodinové zmeny': [],
    'Špeciálne zmeny': []
  });
  const { user } = useUser();

  useEffect(() => {
    checkAuth();
    fetchEmployees();
    fetchAbsences();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [viewMode]);

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      if (!session) {
        // Ak nie je session, pokúsime sa prihlásiť ako anon
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: 'anonymous@example.com',
          password: 'anonymous'
        });
        
        if (signInError) throw signInError;
      }
      
      setAuthError(null);
    } catch (error) {
      console.error('Auth error:', error);
      setAuthError('Chyba autentifikácie');
    }
  };

  const fetchEmployees = async () => {
    try {
      if (viewMode === 'operators') {
        // Načítanie len bežných zamestnancov
        const { data: regularEmployees, error: regularError } = await supabase
        .from('zamestnanci')
          .select('id, meno, celkova_dovolenka, zmena')
        .order('meno');

        if (regularError) throw regularError;

        const formattedEmployees = regularEmployees.map((emp: any) => ({
          id: `reg-${emp.id}`,
          meno: emp.meno,
          celkova_dovolenka: emp.celkova_dovolenka || 20,
          zmena: emp.zmena
        }));

        // Rozdelíme zmeny do skupín
        const standardShifts = new Set<string>();
        const twelveHourShifts = new Set<string>();
        const specialShifts = new Set<string>();

        regularEmployees.forEach((emp: any) => {
          if (!emp.zmena) return;
          
          if (emp.zmena.match(/^[A-DO]$/)) {
            standardShifts.add(emp.zmena);
          } else if (emp.zmena.match(/^[A-D]12$/)) {
            twelveHourShifts.add(emp.zmena);
          } else {
            specialShifts.add(emp.zmena);
          }
        });

        const newShifts = {
          'Štandardné zmeny': Array.from(standardShifts).sort(),
          '12-hodinové zmeny': Array.from(twelveHourShifts).sort(),
          'Špeciálne zmeny': Array.from(specialShifts).sort()
        };
        setAvailableShifts(newShifts);

        setEmployees(formattedEmployees);
      } else {
        // Načítanie len VZ a zoraďovačov
        const { data: vzzormanEmployees, error: vzzormanError } = await supabase
          .from('vzzorman')
          .select('id, meno, pozicia')
          .order('pozicia, meno');  // najprv zoradíme podľa pozície, potom podľa mena

        if (vzzormanError) throw vzzormanError;

        // Definujeme poradie pozícií
        const positionOrder = {
          'VZA12': 1,
          'VZB12': 2,
          'VZC12': 3,
          'VZD12': 4,
          'ZoradovacA12': 5,
          'ZoradovacB12': 6,
          'ZoradovacC12': 7,
          'ZoradovacD12': 8,
          'ManipulantA': 9,
          'ManipulantC': 10,
          'ManipulantD': 11,
          'ManipulantO': 12,
          'Drvič': 13
        };

        const formattedEmployees = vzzormanEmployees
          .map((emp: any) => ({
            id: `vz-${emp.id}`,
            meno: emp.meno,
            pozicia: emp.pozicia,
            celkova_dovolenka: 20,
            positionOrder: positionOrder[emp.pozicia as keyof typeof positionOrder] || 999 // ak pozícia nie je v zozname, dáme ju na koniec
          }))
          .sort((a, b) => {
            // Najprv zoradíme podľa poradia pozície
            if (a.positionOrder !== b.positionOrder) {
              return a.positionOrder - b.positionOrder;
            }
            // Ak majú rovnakú pozíciu, zoradíme podľa mena
            return a.meno.localeCompare(b.meno);
          })
          .map(({ positionOrder, ...emp }) => emp); // odstránime pomocné pole positionOrder

        setEmployees(formattedEmployees);
      }
    } catch (err: any) {
      console.error('Chyba pri načítaní zamestnancov:', err);
      setAuthError('Nepodarilo sa načítať zamestnancov');
    } finally {
      setLoading(false);
    }
  };

  const fetchAbsences = async () => {
    try {
      console.log('Začínam načítavať absencie...');
      const { data, error } = await supabase
        .from('absencie')
        .select('*')
        .order('datum_od', { ascending: true });

      if (error) {
        console.error('Supabase error pri načítaní absencií:', error);
        throw error;
      }

      console.log('Načítané absencie z databázy:', data?.map(a => ({
        id: a.id,
        employee_id: a.employee_id,
        employee_type: a.employee_type,
        typ_absencie: a.typ_absencie,
        datum_od: a.datum_od,
        datum_do: a.datum_do
      })));

      setAbsences(data || []);
    } catch (error) {
      console.error('Chyba pri načítaní absencií:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkOverlappingAbsences = (employeeId: string, start: Date, end: Date) => {
    const dbId = parseInt(employeeId.split('-')[1]);
    const employeeType = employeeId.startsWith('vz-') ? 'vzzorman' : 'zamestnanci';
    return absences.filter(absence => {
      if (absence.employee_id !== dbId || absence.employee_type !== employeeType) return false;
      
      const absenceStart = new Date(absence.datum_od);
      const absenceEnd = new Date(absence.datum_do);
      
      return (
        (start <= absenceEnd && end >= absenceStart) || // Prekrývanie
        (start >= absenceStart && end <= absenceEnd) || // Obsahuje
        (start <= absenceStart && end >= absenceEnd)    // Obsahované
      );
    });
  };

  const handleAddAbsence = async (employeeId: string, start: Date, end: Date, type: 'dovolenka' | 'pn' | '§' | 'LS' | 'neratat', poznamka?: string) => {
    try {
      // Odstránime prefix z ID pre vyhľadávanie v databáze
      const dbId = parseInt(employeeId.split('-')[1]);
      const employeeType = employeeId.startsWith('vz-') ? 'vzzorman' : 'zamestnanci';
      
      console.log('Pridávam absenciu - vstupné parametre:', {
        employeeId,
        dbId,
        employeeType,
        start: start.toISOString(),
        end: end.toISOString(),
        type,
        startType: typeof start,
        endType: typeof end,
        dbIdType: typeof dbId,
        employeeTypeType: typeof employeeType
      });
      
      // Najprv skontrolujeme session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Nie ste prihlásený');
      }

      // Kontrola prekrývajúcich sa absencií
      const overlappingAbsences = checkOverlappingAbsences(employeeId, start, end);
      console.log('Nájdené prekrývajúce sa absencie:', overlappingAbsences);
      
      if (overlappingAbsences.length > 0) {
        // Ak existujú prekrývajúce sa absencie, najprv ich vymažeme
        for (const absence of overlappingAbsences) {
          console.log('Mažem prekrývajúcu sa absenciu:', {
            id: absence.id,
            employee_id: absence.employee_id,
            employee_type: absence.employee_type,
            typ_absencie: absence.typ_absencie,
            datum_od: absence.datum_od,
            datum_do: absence.datum_do
          });
          const { error: deleteError } = await supabase
            .from('absencie')
            .delete()
            .eq('id', absence.id);

          if (deleteError) throw deleteError;
        }
      }

      const absenceData = {
        employee_id: dbId,
        employee_type: employeeType,
        typ_absencie: type,
        datum_od: start.toISOString(),
        datum_do: end.toISOString(),
        poznamka: poznamka || null
      };

      console.log('Pridávam novú absenciu do databázy:', absenceData);

      const { data, error } = await supabase
        .from('absencie')
        .insert([absenceData])
        .select();

      if (error) {
        console.error('Supabase error pri pridávaní absencie:', error);
        throw error;
      }

      console.log('Absencia úspešne pridaná:', data);
      await fetchAbsences();
      setIsAddingAbsence(false);
      setStartDate(null);
      setEndDate(null);
      setSelectedEmployee(null);
    } catch (error) {
      console.error('Chyba pri pridávaní absencie:', error);
      setAuthError(error instanceof Error ? error.message : 'Neznáma chyba');
    }
  };

  const calculateEmployeeStats = (employeeId: string): EmployeeStats => {
    const dbId = parseInt(employeeId.split('-')[1]);
    const employeeType = employeeId.startsWith('vz-') ? 'vzzorman' : 'zamestnanci';
    const employee = employees.find(e => e.id === employeeId);
    const employeeAbsences = absences.filter(a => a.employee_id === dbId && a.employee_type === employeeType);
    
    const dovolenky = employeeAbsences.filter(a => a.typ_absencie === 'dovolenka');
    const paragrafy = employeeAbsences.filter(a => a.typ_absencie === '§');
    const ls = employeeAbsences.filter(a => a.typ_absencie === 'LS');
    
    const vycerpanaDovolenka = dovolenky.reduce((sum, absence) => {
      return sum + differenceInDays(new Date(absence.datum_do), new Date(absence.datum_od)) + 1;
    }, 0);

    const vycerpaneParagrafy = paragrafy.reduce((sum, absence) => {
      return sum + differenceInDays(new Date(absence.datum_do), new Date(absence.datum_od)) + 1;
    }, 0);

    const vycerpaneLs = ls.reduce((sum, absence) => {
      return sum + differenceInDays(new Date(absence.datum_do), new Date(absence.datum_od)) + 1;
    }, 0);

    const celkovaDovolenka = employee?.celkova_dovolenka || 20;

    return {
      celkova_dovolenka: celkovaDovolenka,
      vycerpana_dovolenka: vycerpanaDovolenka,
      zostava_dovolenka: celkovaDovolenka - vycerpanaDovolenka,
      celkove_paragrafy: 7,
      vycerpane_paragrafy: vycerpaneParagrafy,
      zostava_paragrafy: 7 - vycerpaneParagrafy,
      celkove_ls: 7,
      vycerpane_ls: vycerpaneLs,
      zostava_ls: 7 - vycerpaneLs
    };
  };

  const handleContextMenu = (e: React.MouseEvent, absence: Absence) => {
    e.preventDefault();
    setContextMenu({
      position: { x: e.clientX, y: e.clientY },
      absence
    });
  };

  const handleDeleteAbsence = async (absenceId: number) => {
    const absence = absences.find(a => a.id === absenceId);
    if (absence) {
      setAbsenceToDelete(absence);
      setShowAbsenceDeleteConfirm(true);
    }
  };

  const handleEditAbsence = (absence: Absence) => {
    setEditingAbsence(absence);
    setContextMenu(null);
  };

  const handleUpdateAbsence = async (absenceId: number, updates: Partial<Absence>) => {
    try {
      const { error } = await supabase
        .from('absencie')
        .update(updates)
        .eq('id', absenceId);

      if (error) throw error;
      
      setEditingAbsence(null);
      fetchAbsences();
    } catch (error) {
      console.error('Chyba pri úprave absencie:', error);
    }
  };

  const resetSelection = () => {
    setIsAddingAbsence(false);
    setStartDate(null);
    setEndDate(null);
    setSelectedEmployee(null);
    setHoverEndDate(null);
    setShowConfirmation(false);
    setPendingAbsence(null);
    setAbsenceNote('');
  };

  const confirmAddAbsence = async () => {
    if (!pendingAbsence) return;
    
    const { employeeId, start, end, type } = pendingAbsence;
    await handleAddAbsence(employeeId, start, end, type, absenceNote);
    resetSelection();
  };

  const handleCellClick = (employee: Employee, date: Date) => {
    // Kontrola oprávnení pre správu absencií
    const canManageAbsences = user?.role === 'admin' || 
                              user?.role === 'manager' || 
                              user?.role === 'timlider' ||
                              user?.role === 'managervyroby' ||
                              user?.role === 'managerkvalita' ||
                              user?.role === 'managermechanik';

    if (!canManageAbsences) return;

    if (!selectedType) {
      setShowTypeWarning(true);
      return;
    }

    if (!startDate) {
      setStartDate(date);
      setEndDate(date);
      setSelectedEmployee(employee);
      setIsAddingAbsence(true);
    } else {
      if (selectedEmployee?.id !== employee.id) {
        alert('Koncový dátum musí byť vybraný pre toho istého operátora');
        return;
      }

      const start = new Date(Math.min(startDate.getTime(), date.getTime()));
      const end = new Date(Math.max(startDate.getTime(), date.getTime()));
      
      if (selectedType === '§') {
        setPendingAbsence({
          employeeId: employee.id,
          start,
          end,
          type: '§' as const
        });
        setShowConfirmation(true);
      } else {
        setPendingAbsence({
          employeeId: employee.id,
          start,
          end,
          type: selectedType
        });
        setShowConfirmation(true);
      }
      setIsAddingAbsence(false);
      setStartDate(null);
      setEndDate(null);
      setSelectedEmployee(null);
    }
  };

  const getDaysInMonth = () => {
    return eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth)
    });
  };

  const getAbsenceForDay = (employeeId: string, date: Date) => {
    const dbId = parseInt(employeeId.split('-')[1]);
    return absences.find(absence => {
      const absenceStart = new Date(absence.datum_od);
      const absenceEnd = new Date(absence.datum_do);
      const isInRange = (
        date >= absenceStart && 
        date <= absenceEnd
      );
      return absence.employee_id === dbId && isInRange;
    });
  };

  const isSelectingRange = (employee: Employee, date: Date) => {
    if (!isAddingAbsence || !startDate || selectedEmployee?.id !== employee.id) return false;
    
    const end = hoverEndDate || date;
    const isInRange = (
      (date >= startDate && date <= end) || 
      (date <= startDate && date >= end)
    );
    
    return isInRange;
  };

  const handleCellMouseEnter = (employee: Employee, date: Date) => {
    if (isAddingAbsence && startDate && selectedEmployee?.id === employee.id) {
      setHoverEndDate(date);
    }
  };

  const handleCellMouseLeave = () => {
    setHoverEndDate(null);
  };

  const handleAbsenceTypeChange = (type: 'dovolenka' | 'pn' | '§' | 'LS' | 'neratat') => {
    // Ak máme vybraný počiatočný dátum, resetujeme výber
    if (startDate) {
      setStartDate(null);
      setEndDate(null);
      setSelectedEmployee(null);
      setIsAddingAbsence(false);
      setHoverEndDate(null);
    }
    setSelectedType(type);
  };

  const handleUpdateTotalVacation = async (employeeId: string, newTotal: number) => {
    try {
      const dbId = parseInt(employeeId.split('-')[1]);
      
      const { error } = await supabase
        .from('zamestnanci')
        .update({ celkova_dovolenka: newTotal })
        .eq('id', dbId);

      if (error) throw error;
      
      // Aktualizujeme lokálny stav
      setEmployees(prevEmployees => 
        prevEmployees.map(emp => 
          emp.id === employeeId 
            ? { ...emp, celkova_dovolenka: newTotal }
            : emp
        )
      );
    } catch (error) {
      console.error('Chyba pri úprave celkovej dovolenky:', error);
    }
  };

  const renderCalendarHeader = () => {
    const days = getDaysInMonth();
    return (
      <div className="vacation-month-navigation">
        <div className="vacation-month-navigation-left">
          <button onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
            &lt;
          </button>
          <h2>{format(currentMonth, 'LLLL yyyy', { locale: sk })}</h2>
          <button onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
            &gt;
          </button>
        </div>
      </div>
    );
  };

  const renderCalendarBody = () => {
    const days = getDaysInMonth();
    return (
      <div className="vacation-calendar-body">
        {employees.map(employee => (
          <div key={employee.id} className="vacation-calendar-row">
            <div 
              className="vacation-employee-name"
              onClick={() => setShowEmployeeModal(employee.id)}
              style={{ cursor: 'pointer' }}
              title="Kliknite pre zobrazenie detailov"
            >
              {renderEmployeeName(employee)}
            </div>
            {days.map(day => {
              const absence = getAbsenceForDay(employee.id, day);
              const isSelecting = isSelectingRange(employee, day);
              return (
                <div
                  key={day.getTime()}
                  className={`vacation-calendar-cell ${absence ? `vacation-absence-${absence.typ_absencie}` : ''} ${isSelecting ? 'selecting' : ''}`}
                  onClick={() => handleCellClick(employee, day)}
                  onMouseEnter={() => handleCellMouseEnter(employee, day)}
                  onMouseLeave={handleCellMouseLeave}
                  onContextMenu={(e) => absence && handleContextMenu(e, absence)}
                  title={absence ? `${employee.meno} - ${format(day, 'dd.MM.yyyy')} - ${absence.typ_absencie === 'dovolenka' ? 'Dovolenka' : absence.typ_absencie === 'pn' ? 'PN' : absence.typ_absencie === '§' ? '§' : absence.typ_absencie === 'LS' ? 'Lekár Sprievod' : 'Nerátať'}` : undefined}
                >
                  {absence && <div className="vacation-absence-indicator">
                    {absence.typ_absencie === 'dovolenka' ? 'D' : 
                     absence.typ_absencie === 'pn' ? 'PN' : 
                     absence.typ_absencie === '§' ? '§' : 
                     absence.typ_absencie === 'LS' ? 'LS' : '-'}
                  </div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderEmployeeName = (employee: Employee) => {
    if (employee.pozicia) {
      const isVZ = employee.pozicia.startsWith('VZ');
      const isZoradovac = employee.pozicia.startsWith('Zoradovac');
      const isManipulant = employee.pozicia.startsWith('Manipulant');
      const isDrvic = employee.pozicia === 'Drvič';

      return (
        <span 
          className="vacation-employee-name" 
          onClick={() => setShowEmployeeModal(employee.id)}
          style={{ cursor: 'pointer' }}
          title="Kliknite pre zobrazenie detailov"
        >
          {employee.meno}
          {isVZ && <span className="vacation-veduci-marker">(VZ)</span>}
          {isZoradovac && <span className="vacation-zoradovac-marker">(Z)</span>}
          {isManipulant && <span className="vacation-manipulant-marker">(Man)</span>}
          {isDrvic && <span className="vacation-drvic-marker">(Drvič)</span>}
        </span>
      );
    }
    return (
      <span 
        className="vacation-employee-name" 
        onClick={() => setShowEmployeeModal(employee.id)}
        style={{ cursor: 'pointer' }}
        title="Kliknite pre zobrazenie detailov"
      >
        {employee.meno}
        {employee.zmena === 'kvalita' && <span className="vacation-kvalita-marker">(Kvalita)</span>}
        {employee.zmena === 'mechanik' && <span className="vacation-mechanik-marker">(Mech)</span>}
      </span>
    );
  };

  const renderEmployeeModal = (employee: Employee) => {
    const stats = calculateEmployeeStats(employee.id);
    return (
      <div key={`modal-${employee.id}`} className="vacation-stats-modal-overlay" onClick={() => setShowEmployeeModal(null)}>
        <div className="vacation-stats-modal" onClick={e => e.stopPropagation()}>
          <div className="vacation-stats-modal-header">
            <h2>{employee.meno}</h2>
            <button className="vacation-stats-modal-close" onClick={() => setShowEmployeeModal(null)}>×</button>
          </div>
          <div className="vacation-stats-modal-content">
            <div className="vacation-stats-section">
              <h3>Dovolenka</h3>
              <div className="vacation-stats-info">
                <div className="vacation-stats-row">
                  <span>Celková dovolenka:</span>
                  {isEditingTotal ? (
                    <div className="vacation-stats-edit">
                      <input
                        type="number"
                        value={newTotal}
                        onChange={(e) => setNewTotal(Number(e.target.value))}
                        min="0"
                        max="365"
                        className="vacation-stats-input"
                      />
                      <button 
                        className="vacation-stats-save"
                        onClick={() => {
                          handleUpdateTotalVacation(employee.id, newTotal);
                          setIsEditingTotal(false);
                        }}
                      >
                        ✓
                      </button>
                      <button 
                        className="vacation-stats-cancel"
                        onClick={() => {
                          setNewTotal(stats.celkova_dovolenka);
                          setIsEditingTotal(false);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="vacation-stats-value">
                      <span>{stats.celkova_dovolenka}</span>
                      <button 
                        className="vacation-stats-edit-button"
                        onClick={() => {
                          setNewTotal(stats.celkova_dovolenka);
                          setIsEditingTotal(true);
                        }}
                      >
                        ✎
                      </button>
                    </div>
                  )}
                </div>
                <div className="vacation-stats-row">
                  <span>Minutá dovolenka:</span>
                  <div className="vacation-stats-value">
                    <span>{stats.vycerpana_dovolenka}</span>
                  </div>
                </div>
                <div className="vacation-stats-row">
                  <span>Zostávajúca dovolenka:</span>
                  <div className="vacation-stats-value">
                  <span>{stats.zostava_dovolenka}</span>
                </div>
                </div>
              </div>
            </div>
            <div className="vacation-stats-section">
              <h3>Paragraf</h3>
              <div className="vacation-form-group">
                <label>Celkový paragraf:</label>
                  <span>{stats.celkove_paragrafy}</span>
                </div>
              <div className="vacation-form-group">
                <label>Zostávajúci:</label>
                  <span>{stats.zostava_paragrafy}</span>
                </div>
              <div className="vacation-form-group">
                <label>Minutý:</label>
                  <span>{stats.vycerpane_paragrafy}</span>
                </div>
              </div>
            <div className="vacation-stats-section">
              <h3>Lekár Sprievod</h3>
              <div className="vacation-form-group">
                <label>Celkový LS:</label>
                  <span>{stats.celkove_ls}</span>
                </div>
              <div className="vacation-form-group">
                <label>Zostávajúci:</label>
                  <span>{stats.zostava_ls}</span>
                </div>
              <div className="vacation-form-group">
                <label>Minutý:</label>
                  <span>{stats.vycerpane_ls}</span>
                </div>
              </div>
            </div>
          <div className="vacation-stats-modal-actions">
            <button onClick={() => setShowEmployeeModal(null)}>Zavrieť</button>
          </div>
        </div>
      </div>
    );
  };

  // Funkcia na odstránenie diakritiky
  const removeDiacritics = (str: string) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  // Funkcia na filtrovanie operátorov
  const filterOperators = (operators: any[]) => {
    let filtered = operators;
    
    // Filtrovanie podľa mena
    if (searchQuery.trim()) {
    const normalizedQuery = removeDiacritics(searchQuery.toLowerCase());
      filtered = filtered.filter(operator => 
      removeDiacritics(operator.meno.toLowerCase()).includes(normalizedQuery)
    );
    }
    
    // Filtrovanie podľa zmeny
    if (selectedShift !== 'all') {
      filtered = filtered.filter(operator => {
        // Kontrolujeme či má operátor zmenu a či sa zhoduje s vybranou
        return operator.zmena && operator.zmena === selectedShift;
      });
    }
    
    return filtered;
  };

  const handleDeleteClick = (vacation: Vacation) => {
    setVacationToDelete(vacation);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!vacationToDelete) return;

    try {
      const { error } = await supabase
        .from('vacations')
        .delete()
        .eq('id', vacationToDelete.id);

      if (error) throw error;

      setVacations(vacations.filter((v: Vacation) => v.id !== vacationToDelete.id));
      setShowDeleteConfirm(false);
      setVacationToDelete(null);
    } catch (error) {
      console.error('Chyba pri mazaní dovolenky:', error);
      alert('Nepodarilo sa vymazať dovolenku');
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setVacationToDelete(null);
  };

  const handleConfirmAbsenceDelete = async () => {
    if (!absenceToDelete) return;

    try {
      const { error } = await supabase
        .from('absencie')
        .delete()
        .eq('id', absenceToDelete.id);

      if (error) throw error;
      
      setContextMenu(null);
      fetchAbsences();
    } catch (error) {
      console.error('Chyba pri mazaní absencie:', error);
    } finally {
      setShowAbsenceDeleteConfirm(false);
      setAbsenceToDelete(null);
    }
  };

  const handleCancelAbsenceDelete = () => {
    setShowAbsenceDeleteConfirm(false);
    setAbsenceToDelete(null);
  };

  // Pridáme CSS štýly pre nové markery
  const styles = `
  .vacation-kvalita-marker,
  .vacation-mechanik-marker {
    font-size: 10px;
    padding: 1px 4px;
    border-radius: 3px;
    margin-left: 6px;
    font-weight: 500;
    letter-spacing: 0.5px;
    background: rgba(33, 150, 243, 0.2);
    color: #90caf9;
    border: 1px solid rgba(33, 150, 243, 0.3);
  }
  `;

  // Pridáme štýly do head
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);

  return (
    <div className="vacation-page">
      <h1>Dovolenky a absencie</h1>
      
      {authError && (
        <div className="vacation-error-message">
          {authError}
        </div>
      )}
      
      <div className="vacation-view-mode-switch">
        <button 
          className={`vacation-view-mode-button ${viewMode === 'operators' ? 'active' : ''}`}
          onClick={() => setViewMode('operators')}
        >
          Operátori
        </button>
        <button 
          className={`vacation-view-mode-button ${viewMode === 'vzzorman' ? 'active' : ''}`}
          onClick={() => setViewMode('vzzorman')}
        >
          VZ/Zoraďovači
        </button>
      </div>
      
      <div className="vacation-container">
        <div className="vacation-controls">
          <div className="vacation-absence-type-buttons">
            <button 
              className={`vacation-absence-button ${selectedType === 'dovolenka' ? 'active' : ''}`}
              onClick={() => handleAbsenceTypeChange('dovolenka')}
            >
              <span className="vacation-icon">🏖️</span>
              Dovolenka
            </button>
            <button 
              className={`vacation-absence-button ${selectedType === 'pn' ? 'active' : ''}`}
              onClick={() => handleAbsenceTypeChange('pn')}
            >
              <span className="vacation-icon">🤒</span>
              PN
            </button>
            <button 
              className={`vacation-absence-button ${selectedType === '§' ? 'active' : ''}`}
              onClick={() => handleAbsenceTypeChange('§')}
            >
              <span className="vacation-icon">📋</span>
              §
            </button>
            <button 
              className={`vacation-absence-button ${selectedType === 'neratat' ? 'active' : ''}`}
              onClick={() => handleAbsenceTypeChange('neratat')}
            >
              <span className="vacation-icon"><FaBan /></span>
              Nerátať
            </button>
          </div>
        </div>

        <div className="vacation-calendar-container">
          {renderCalendarHeader()}
          <div className="vacation-search-container">
            <div className="vacation-search-row">
            <input
              type="text"
              className="vacation-search-input"
              placeholder="Vyhľadať operátora..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
              <div className="vacation-shift-filters">
                <button 
                  className={`vacation-shift-button ${selectedShift === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedShift('all')}
                >
                  Všetky
                </button>
                {(Object.entries(availableShifts) as [string, string[]][]).map(([groupName, shifts]) => 
                  shifts.length > 0 ? (
                    <div key={groupName} className="shift-group">
                      <div className="shift-group-title">{groupName}</div>
                      <div className="shift-group-buttons">
                        {shifts.map((shift: string) => (
                          <button 
                            key={shift}
                            className={`vacation-shift-button ${selectedShift === shift ? 'active' : ''}`}
                            onClick={() => setSelectedShift(shift)}
                          >
                            Zmena {shift}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          </div>
          <div className="vacation-days-header">
            <div className="vacation-employee-column">Zamestnanec</div>
            {getDaysInMonth().map(day => (
              <div key={day.getTime()} className="vacation-day-column">
                <div className="vacation-day-name">{format(day, 'EEEEE', { locale: sk })}</div>
                <div className="vacation-day-number">{format(day, 'd')}</div>
              </div>
            ))}
          </div>
          <div className="vacation-calendar-body">
            {filterOperators(employees).map((operator) => (
              <div key={operator.id} className="vacation-calendar-row">
                <div 
                  className="vacation-employee-column"
                  onClick={() => setShowEmployeeModal(operator.id)}
                  style={{ cursor: 'pointer' }}
                  title="Kliknite pre zobrazenie detailov"
                >
                  {renderEmployeeName(operator)}
                </div>
                {getDaysInMonth().map(day => {
                  const absence = getAbsenceForDay(operator.id, day);
                  const isSelecting = isSelectingRange(operator, day);
                  return (
                    <div
                      key={day.getTime()}
                      className={`vacation-calendar-cell ${absence ? `vacation-absence-${absence.typ_absencie}` : ''} ${isSelecting ? 'selecting' : ''}`}
                      onClick={() => handleCellClick(operator, day)}
                      onMouseEnter={() => handleCellMouseEnter(operator, day)}
                      onMouseLeave={handleCellMouseLeave}
                      onContextMenu={(e) => absence && handleContextMenu(e, absence)}
                      title={absence ? `${operator.meno} - ${format(day, 'dd.MM.yyyy')} - ${absence.typ_absencie === 'dovolenka' ? 'Dovolenka' : absence.typ_absencie === 'pn' ? 'PN' : absence.typ_absencie === '§' ? '§' : absence.typ_absencie === 'LS' ? 'Lekár Sprievod' : 'Nerátať'}${absence.poznamka ? `\nPoznámka: ${absence.poznamka}` : ''}` : undefined}
                    >
                      {absence && <div className="vacation-absence-indicator">
                        {absence.typ_absencie === 'dovolenka' ? 'D' : 
                         absence.typ_absencie === 'pn' ? 'PN' : 
                         absence.typ_absencie === '§' ? '§' : 
                         absence.typ_absencie === 'LS' ? 'LS' : '-'}
                      </div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {contextMenu && (
        <div 
          className="vacation-context-menu"
          style={{ top: contextMenu.position.y, left: contextMenu.position.x }}
        >
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <>
          <button onClick={() => handleEditAbsence(contextMenu.absence)}>Upraviť</button>
          <button onClick={() => handleDeleteAbsence(contextMenu.absence.id)}>Vymazať</button>
            </>
          )}
        </div>
      )}

      {showEmployeeModal !== null && (() => {
        const employee = employees.find(e => e.id === showEmployeeModal);
        if (!employee) return null;
        return renderEmployeeModal(employee);
      })()}

      {showConfirmation && pendingAbsence && (
        <div className="vacation-confirmation-overlay" onClick={() => resetSelection()}>
          <div className="vacation-confirmation-modal" onClick={e => e.stopPropagation()}>
            <div className="vacation-confirmation-header">
              <h2>Potvrdenie pridania absencie</h2>
              <button className="vacation-confirmation-close" onClick={() => resetSelection()}>×</button>
            </div>
            <div className="vacation-confirmation-content">
              <div className="vacation-confirmation-info">
                <div className="vacation-confirmation-name">
                  {employees.find(e => e.id === pendingAbsence.employeeId)?.meno}
                </div>
                <div className="vacation-confirmation-dates">
                  <span>Od: {format(pendingAbsence.start, 'dd.MM.yyyy')}</span>
                  <span>Do: {format(pendingAbsence.end, 'dd.MM.yyyy')}</span>
                </div>
                {pendingAbsence.type === '§' ? (
                  <div className="vacation-confirmation-type-selection">
                    <p>Vyberte typ absencie:</p>
                    <div className="vacation-confirmation-type-buttons">
                    <button 
                        className="vacation-confirmation-type-button"
                      onClick={() => {
                          handleAddAbsence(pendingAbsence.employeeId, pendingAbsence.start, pendingAbsence.end, '§', absenceNote);
                        resetSelection();
                      }}
                    >
                      §
                    </button>
                    <button 
                        className="vacation-confirmation-type-button"
                      onClick={() => {
                          handleAddAbsence(pendingAbsence.employeeId, pendingAbsence.start, pendingAbsence.end, 'LS', absenceNote);
                        resetSelection();
                      }}
                    >
                      LS
                    </button>
                  </div>
                </div>
                ) : (
                  <div className="vacation-confirmation-type">
                    Typ: {pendingAbsence.type}
                  </div>
                )}
                <div className="vacation-confirmation-note">
                  <label htmlFor="absence-note">Poznámka (voliteľné):</label>
                  <textarea
                    id="absence-note"
                    className="vacation-confirmation-note-input"
                    placeholder="Zadajte poznámku k absencii..."
                    value={absenceNote}
                    onChange={(e) => setAbsenceNote(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
              {pendingAbsence.type !== '§' && (
              <div className="vacation-confirmation-actions">
                <button className="vacation-confirmation-button confirm" onClick={confirmAddAbsence}>
                    Potvrdiť
                  </button>
                <button className="vacation-confirmation-button cancel" onClick={() => resetSelection()}>
                    Zrušiť
                  </button>
                </div>
              )}
          </div>
        </div>
      )}

      {editingAbsence && (
        <div className="vacation-modal-overlay" onClick={() => setEditingAbsence(null)}>
          <div className="vacation-modal-content" onClick={e => e.stopPropagation()}>
            <h2>Upraviť absenciu</h2>
            <div className="vacation-form-group">
              <label>Typ:</label>
              <select 
                value={editingAbsence.typ_absencie}
                onChange={(e) => setEditingAbsence({
                  ...editingAbsence,
                  typ_absencie: e.target.value as 'dovolenka' | 'pn' | '§' | 'LS' | 'neratat'
                })}
              >
                <option value="dovolenka">Dovolenka</option>
                <option value="pn">PN</option>
                <option value="§">§</option>
                <option value="LS">LS</option>
                <option value="neratat">Nerátať</option>
              </select>
            </div>
            <div className="vacation-form-group">
              <label>Od:</label>
              <DatePicker
                selected={new Date(editingAbsence.datum_od)}
                onChange={(date) => date && setEditingAbsence({
                  ...editingAbsence,
                  datum_od: date.toISOString()
                })}
                dateFormat="dd.MM.yyyy"
                locale={sk}
                className="vacation-date-picker"
              />
            </div>
            <div className="vacation-form-group">
              <label>Do:</label>
              <DatePicker
                selected={new Date(editingAbsence.datum_do)}
                onChange={(date) => date && setEditingAbsence({
                  ...editingAbsence,
                  datum_do: date.toISOString()
                })}
                dateFormat="dd.MM.yyyy"
                locale={sk}
                className="vacation-date-picker"
              />
            </div>
            <div className="vacation-form-group">
              <label>Poznámka:</label>
              <textarea
                value={editingAbsence.poznamka || ''}
                onChange={(e) => setEditingAbsence({
                  ...editingAbsence,
                  poznamka: e.target.value
                })}
                className="vacation-date-picker"
                rows={3}
                placeholder="Zadajte poznámku k absencii..."
              />
            </div>
            <div className="vacation-modal-actions">
              <button onClick={() => handleUpdateAbsence(editingAbsence.id, editingAbsence)}>
                Uložiť
              </button>
              <button onClick={() => setEditingAbsence(null)}>Zrušiť</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showTypeWarning}
        title="Vyberte typ absencie"
        message="Pred výberom dátumu prosím vyberte typ absencie."
        confirmText="OK"
        onConfirm={() => setShowTypeWarning(false)}
        onCancel={() => setShowTypeWarning(false)}
        type="warning"
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Vymazať dovolenku"
        message="Naozaj chcete vymazať túto dovolenku?"
        confirmText="Vymazať"
        cancelText="Zrušiť"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        type="danger"
      />

      <ConfirmDialog
        isOpen={showAbsenceDeleteConfirm}
        title="Vymazať absenciu"
        message={`Naozaj chcete vymazať túto absenciu (${absenceToDelete?.typ_absencie})?`}
        confirmText="Vymazať"
        cancelText="Zrušiť"
        onConfirm={handleConfirmAbsenceDelete}
        onCancel={handleCancelAbsenceDelete}
        type="danger"
      />
    </div>
  );
}

export default VacationPage; 