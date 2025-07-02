import React, { useState, useEffect } from 'react';
import supabase from '../lib/supabase';
import '../App.css';
import 'react-datepicker/dist/react-datepicker.css';
import { format, isSameDay } from 'date-fns';
import { sk } from 'date-fns/locale';
import { FaCalendar, FaUmbrella, FaHeartbeat, FaGavel, FaBalanceScale, FaUmbrellaBeach, FaParagraph, FaBan } from 'react-icons/fa';
import { GiIsland } from 'react-icons/gi';
import { GoLog } from 'react-icons/go';
import { PiIsland } from "react-icons/pi";
import './SchedulePage.css';
import { useUser } from '../context/UserContext';
import ConfirmDialog from '../components/ConfirmDialog';

interface Operator {
  id: number | string;
  name: string;
  team: string;
  nocne: boolean;
  kategoria: string;
  zaciatok7: boolean;
  zmena: string;
  angetura?: boolean;
  absences?: Absence[];
  materska?: boolean;
}

interface ShiftRotation {
  [key: string]: string;
}

type AbsenceType = 'dovolenka' | 'pn' | '§' | 'LS' | 'neratat';

interface Absence {
  id: number;
  employee_id: number;
  typ_absencie: AbsenceType;
  datum_od: string;
  datum_do: string;
  employee_type?: string;
}

interface TemporaryOperator {
  id: string;
  name: string;
  shift: string;
  dates: Date[];
  created_at?: string;
  count_in_total: boolean;
}

interface VZEmployee {
  id: number;
  meno: string;
  pozicia: string;
  created_at: string;
}

interface Deputy {
  id: string;
  name: string;
  position: string;  // 'VZ' alebo 'Z'
  team: string;      // 'A12', 'B12', 'C12', 'D12'
  date: Date;
  deputy_name: string;
}

const MANIPULANT_POSITIONS = [
  { pozicia: 'ManipulantA', shift: 'A' },
  { pozicia: 'ManipulantC', shift: 'C' },
  { pozicia: 'ManipulantD', shift: 'D' },
  { pozicia: 'ManipulantO', shift: 'O' },
];

// Pomocná funkcia na výpočet čísla týždňa (ISO 8601)
function getISOWeek(date: Date) {
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
  // Štvrtok v aktuálnom týždni určuje číslo týždňa
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function getInputWeekValue(date: Date) {
  const year = date.getFullYear();
  const week = getISOWeek(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

const SchedulePage: React.FC = () => {
  const { user } = useUser();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    let monday;
    
    if (dayOfWeek === 6) { // sobota
      monday = new Date(today);
      monday.setDate(today.getDate() - 5);
    } else if (dayOfWeek === 0) { // nedeľa
      monday = new Date(today);
      monday.setDate(today.getDate() - 6);
    } else {
      monday = new Date(today);
      const diff = 1 - dayOfWeek;
      monday.setDate(today.getDate() + diff);
    }
    
    console.log('Initial date:', today);
    console.log('Initial Monday:', monday);
    return monday;
  });
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [showEmployeeModal, setShowEmployeeModal] = useState<number | null>(null);
  const [temporaryOperators, setTemporaryOperators] = useState<TemporaryOperator[]>(() => {
    const savedOperators = localStorage.getItem('temporaryOperators');
    if (savedOperators) {
      const parsed = JSON.parse(savedOperators);
      return parsed.map((op: any) => ({
        ...op,
        dates: op.dates.map((dateStr: string) => new Date(dateStr))
      }));
    }
    return [];
  });
  const [showDatePicker, setShowDatePicker] = useState<{show: boolean, shift: string}>({show: false, shift: ''});
  const [tempOperatorNames, setTempOperatorNames] = useState<{[key: string]: string}>({
    'Ranná zmena': '',
    'Poobedná zmena': '',
    'Nočná zmena': '',
    'Od 7:00 ranná': ''
  });
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [countInTotal, setCountInTotal] = useState(true);
  const [showCountModal, setShowCountModal] = useState<{show: boolean, date: Date | null, shift: string}>({show: false, date: null, shift: ''});
  const [is12HourSchedule, setIs12HourSchedule] = useState(false);
  const [manipulants, setManipulants] = useState<VZEmployee[]>([]);
  const [veduciZmeny, setVeduciZmeny] = useState<VZEmployee[]>([]);
  const [zoradovaci, setZoradovaci] = useState<VZEmployee[]>([]);
  const [showDeputyModal, setShowDeputyModal] = useState<{show: boolean, position: string, team: string, date: Date} | null>(null);
  const [deputyName, setDeputyName] = useState('');
  const [deputies, setDeputies] = useState<Deputy[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{show: boolean, operatorId: number | string | null}>({show: false, operatorId: null});

  const canManageTemporaryOperators = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'timlider';
  const canManageDeputies = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'timlider';

  useEffect(() => {
    if (canManageTemporaryOperators) {
      localStorage.setItem('temporaryOperators', JSON.stringify(temporaryOperators));
    }
  }, [temporaryOperators, canManageTemporaryOperators]);

  useEffect(() => {
    const fetchOperators = async () => {
      try {
        console.log('Začínam načítavať operátorov z databázy...');
        
        // Načítame operátorov z tabuľky zamestnanci
        const { data: zamestnanciData, error: zamestnanciError } = await supabase
          .from('zamestnanci')
          .select('id, meno, zmena, nocne, kategoria, zaciatok7, angetura, materska')
          .order('meno');

        if (zamestnanciError) {
          console.error('Chyba pri načítaní operátorov z zamestnanci:', zamestnanciError);
          throw zamestnanciError;
        }

        // Načítame drviča z tabuľky vzzorman
        const { data: vzzormanData, error: vzzormanError } = await supabase
          .from('vzzorman')
          .select('id, meno, pozicia')
          .eq('pozicia', 'Drvič');

        if (vzzormanError) {
          console.error('Chyba pri načítaní drviča z vzzorman:', vzzormanError);
          throw vzzormanError;
        }

        console.log('Načítaní operátori z zamestnanci:', zamestnanciData);
        console.log('Načítaný drvič z vzzorman:', vzzormanData);

        // Formátujeme operátorov z zamestnanci
        const formattedZamestnanci = zamestnanciData.map((operator: any) => ({
          id: operator.id,
          name: operator.meno,
          team: operator.zmena,
          nocne: operator.nocne,
          kategoria: operator.kategoria,
          zaciatok7: operator.zaciatok7,
          zmena: operator.zmena,
          angetura: operator.angetura,
          materska: operator.materska
        }));

        // Formátujeme drviča z vzzorman
        const formattedDrvic = vzzormanData.map((drvic: any) => ({
          id: `vz-${drvic.id}`,
          name: drvic.meno,
          team: 'Ranná zmena',
          nocne: false,
          kategoria: 'Drvič',
          zaciatok7: false,
          zmena: 'Ranná zmena',
          angetura: false
        }));

        // Spojíme oba zoznamy
        const allOperators = [...formattedZamestnanci, ...formattedDrvic];

        console.log('Všetci formátovaní operátori:', allOperators);
        setOperators(allOperators);
      } catch (err: any) {
        console.error('Chyba pri načítaní operátorov:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOperators();
  }, []);

  useEffect(() => {
    const fetchAbsences = async () => {
      try {
        console.log('Načítavam absencie...');
        const { data, error } = await supabase
          .from('absencie')
          .select('id, employee_id, employee_type, typ_absencie, datum_od, datum_do')
          .order('datum_od', { ascending: true });

        if (error) {
          console.error('Chyba pri načítaní absencií:', error);
          throw error;
        }

        console.log('Načítané absencie:', data);
        if (data) {
          // Skontrolujeme, či máme správne dáta
          data.forEach(absence => {
            console.log('Absencia:', {
              id: absence.id,
              employee_id: absence.employee_id,
              employee_type: absence.employee_type,
              typ_absencie: absence.typ_absencie,
              datum_od: absence.datum_od,
              datum_do: absence.datum_do
            });
          });
        }
        setAbsences(data || []);
      } catch (err: any) {
        console.error('Chyba pri načítaní absencií:', err);
      }
    };

    fetchAbsences();
  }, []);

  useEffect(() => {
    const fetchTemporaryOperators = async () => {
      try {
        const { data, error } = await supabase
          .from('temporary_operators')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        console.log('Fetched temporary operators:', data);

        const formattedOperators = data.map((op: any) => ({
          ...op,
          dates: op.dates.map((dateStr: string) => new Date(dateStr))
        }));

        console.log('Formatted temporary operators:', formattedOperators);
        setTemporaryOperators(formattedOperators);
      } catch (err: any) {
        console.error('Chyba pri načítaní dočasných operátorov:', err);
      }
    };

    fetchTemporaryOperators();
  }, []);

  useEffect(() => {
    const fetchVeduciZmeny = async () => {
      try {
        const { data, error } = await supabase
          .from('vzzorman')
          .select('*')
          .in('pozicia', ['VZA12', 'VZB12', 'VZC12', 'VZD12']);
        if (error) throw error;
        // Pridáme prefix k ID
        const formattedData = data.map(vz => ({
          ...vz,
          id: `vz-${vz.id}`
        }));
        setVeduciZmeny(formattedData || []);
      } catch (err: any) {
        console.error('Chyba pri načítaní vedúcich zmeny:', err);
      }
    };
    fetchVeduciZmeny();
  }, []);

  useEffect(() => {
    const fetchZoradovaci = async () => {
      try {
        const { data, error } = await supabase
          .from('vzzorman')
          .select('*')
          .in('pozicia', ['ZoradovacA12', 'ZoradovacB12', 'ZoradovacC12', 'ZoradovacD12']);
        if (error) throw error;
        // Pridáme prefix k ID
        const formattedData = data.map(z => ({
          ...z,
          id: `vz-${z.id}`
        }));
        setZoradovaci(formattedData || []);
      } catch (err: any) {
        console.error('Chyba pri načítaní zoraďovačov:', err);
      }
    };
    fetchZoradovaci();
  }, []);

  useEffect(() => {
    const fetchManipulants = async () => {
      try {
        const { data, error } = await supabase
          .from('vzzorman')
          .select('*')
          .in('pozicia', MANIPULANT_POSITIONS.map(m => m.pozicia));
        if (error) throw error;
        // Pridáme prefix k ID
        const formattedData = data.map(m => ({
          ...m,
          id: `vz-${m.id}`
        }));
        setManipulants(formattedData || []);
      } catch (err: any) {
        // Nepotrebujeme error handling, manipulanti sú len doplnok
      }
    };
    fetchManipulants();
  }, []);

  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    
    console.log('Week number calculation:', {
      date: date.toISOString(),
      firstDayOfYear: firstDayOfYear.toISOString(),
      pastDaysOfYear,
      weekNumber
    });
    
    return weekNumber;
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      const dayOfWeek = date.getDay();
      let monday = new Date(date);
      if (dayOfWeek === 0) { // nedeľa
        monday.setDate(date.getDate() - 6);
      } else {
        monday.setDate(date.getDate() - (dayOfWeek - 1));
      }
      setSelectedDate(monday);
      setCurrentDate(date);
    }
  };

  const getWeekDates = (date: Date) => {
    const currentDate = new Date(date);
    const dayOfWeek = currentDate.getDay();
    
    let monday;
    if (dayOfWeek === 6) { // sobota
      monday = new Date(currentDate);
      monday.setDate(currentDate.getDate() - 5);
    } else if (dayOfWeek === 0) { // nedeľa
      monday = new Date(currentDate);
      monday.setDate(currentDate.getDate() - 6);
    } else {
      monday = new Date(currentDate);
      const diff = 1 - dayOfWeek;
      monday.setDate(currentDate.getDate() + diff);
    }
    
    const dates = [];
    for (let i = 0; i < 7; i++) { // 7 dní namiesto 5
      const newDate = new Date(monday);
      newDate.setDate(monday.getDate() + i);
      dates.push(newDate);
    }
    
    console.log('Week dates calculation:', {
      inputDate: date.toISOString(),
      monday: monday.toISOString(),
      weekDates: dates.map(d => d.toISOString())
    });
    
    return dates;
  };

  const dates = getWeekDates(selectedDate);

  const getShiftLetter = (shift: string) => {
    const referenceDate = new Date('2025-04-14');
    const diffTime = selectedDate.getTime() - referenceDate.getTime();
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    
    // Základné zmeny
    let shifts = {
      morning: 'A',
      afternoon: 'C',
      night: 'D',
      rp: 'P/R'
    };

    // Ak sme v referenčnom týždni, vrátime základné zmeny
    if (diffWeeks === 0) {
      if (shift === 'Ranná zmena') return shifts.morning;
      if (shift === 'Poobedná zmena') return shifts.afternoon;
      if (shift === 'Nočná zmena') return shifts.night;
      if (shift === 'R/P zmena') return shifts.rp;
      return 'O';
    }

    // Pre týždne po referenčnom dátume rotujeme dopredu
    if (diffWeeks > 0) {
      for (let i = 0; i < diffWeeks; i++) {
        const newShifts = {
          morning: shifts.afternoon,
          afternoon: shifts.night,
          night: shifts.morning,
          rp: shifts.rp === 'R/P' ? 'P/R' : 'R/P'
        };
        shifts = newShifts;
      }
    }
    // Pre týždne pred referenčným dátumom rotujeme dozadu
    else {
      for (let i = 0; i < Math.abs(diffWeeks); i++) {
        const newShifts = {
          morning: shifts.night,
          afternoon: shifts.morning,
          night: shifts.afternoon,
          rp: shifts.rp === 'R/P' ? 'P/R' : 'R/P'
        };
        shifts = newShifts;
      }
    }

    if (shift === 'Ranná zmena') return shifts.morning;
    if (shift === 'Poobedná zmena') return shifts.afternoon;
    if (shift === 'Nočná zmena') return shifts.night;
    if (shift === 'R/P zmena') return shifts.rp;
    return 'O';
  };

  const getOperatorsForShift = (shift: string, date: Date) => {
    // Najprv odfiltrujeme zamestnancov na materskej
    const filteredOperators = operators.filter(op => !op.materska);
    
    console.log('getOperatorsForShift - input:', {
      shift,
      date: date.toISOString(),
      temporaryOperators
    });
    
    const currentMorningShift = getShiftLetter('Ranná zmena');
    const currentAfternoonShift = getShiftLetter('Poobedná zmena');
    const currentNightShift = getShiftLetter('Nočná zmena');

    const shiftMap: { [key: string]: string } = {
      'Ranná zmena': currentMorningShift,
      'Poobedná zmena': currentAfternoonShift,
      'Nočná zmena': currentNightShift,
      'Od 7:00 ranná': 'O'
    };

    const targetShiftLetter = shiftMap[shift] || shift;

    const monday = getWeekDates(date)[0];
    const isOddWeek = monday.getDate() % 2 === 1;

    // Najprv načítame manipulantov
    let manipulantsForShift: VZEmployee[] = [];
    if (shift === 'Ranná zmena') {
      manipulantsForShift = manipulants.filter(m => {
        if (m.pozicia === 'ManipulantA' && currentMorningShift === 'A') return true;
        if (m.pozicia === 'ManipulantC' && currentMorningShift === 'C') return true;
        if (m.pozicia === 'ManipulantD' && currentMorningShift === 'D') return true;
        if (m.pozicia === 'ManipulantO') return true; // ManipulantO vždy v rannom
        return false;
      });
    } else if (shift === 'Poobedná zmena') {
      manipulantsForShift = manipulants.filter(m => {
        if (m.pozicia === 'ManipulantA' && currentAfternoonShift === 'A') return true;
        if (m.pozicia === 'ManipulantC' && currentAfternoonShift === 'C') return true;
        if (m.pozicia === 'ManipulantD' && currentAfternoonShift === 'D') return true;
        return false;
      });
    } else if (shift === 'Nočná zmena') {
      manipulantsForShift = manipulants.filter(m => {
        if (m.pozicia === 'ManipulantA' && currentNightShift === 'A') return true;
        if (m.pozicia === 'ManipulantC' && currentNightShift === 'C') return true;
        if (m.pozicia === 'ManipulantD' && currentNightShift === 'D') return true;
        return false;
      });
    } else if (shift === 'Od 7:00 ranná') {
      manipulantsForShift = []; // Odstránime manipulantov z tejto zmeny
    }

    // Potom načítame ostatných operátorov
    const regularOperators = filteredOperators
      .filter(operator => {
        if (operator.kategoria === 'Manipulant') return false;
        
        const operatorShift = operator.zmena;

        switch(shift) {
          case 'Ranná zmena':
            if (operator.kategoria === 'Drvič') return true;
            if (operatorShift === currentNightShift && !operator.nocne) {
              return true;
            }
            return operatorShift === targetShiftLetter || 
                   (operatorShift === 'R/P' && isOddWeek) ||
                   (operatorShift === 'P/R' && !isOddWeek) ||
                   (operatorShift === 'O' && !operator.zaciatok7);
          case 'Poobedná zmena':
            return operatorShift === targetShiftLetter || 
                   (operatorShift === 'R/P' && !isOddWeek) ||
                   (operatorShift === 'P/R' && isOddWeek);
          case 'Nočná zmena':
            return operatorShift === targetShiftLetter && operator.nocne;
          case 'Od 7:00 ranná':
            return operatorShift === 'O' && operator.zaciatok7;
          default:
            return false;
        }
      });

    const tempOperatorsForDate = temporaryOperators
      .filter(temp => {
        if (temp.shift !== shift) return false;
        
        const weekDates = getWeekDates(date);
        return temp.dates.some(tempDate => {
          const normalizedTempDate = new Date(Date.UTC(
            tempDate.getFullYear(),
            tempDate.getMonth(),
            tempDate.getDate()
          ));
          
          return weekDates.some(weekDate => {
            const normalizedWeekDate = new Date(Date.UTC(
              weekDate.getFullYear(),
              weekDate.getMonth(),
              weekDate.getDate()
            ));
            
            return normalizedTempDate.getTime() === normalizedWeekDate.getTime();
          });
        });
      })
      .map(temp => ({
          id: temp.id,
          name: temp.name,
          team: shift,
          nocne: false,
          kategoria: 'Dočasný',
          zaciatok7: false,
          zmena: shift
      }));
    
    const allOperators = [
      ...manipulantsForShift.map(m => ({
        id: m.id,
        name: m.meno,
        team: shift,
        nocne: false,
        kategoria: 'Manipulant',
        zaciatok7: false,
        zmena: shift,
        angetura: false
      })),
      ...regularOperators,
      ...tempOperatorsForDate
    ];

    return allOperators.sort((a, b) => {
      // Manipulanti vždy na vrchu
      if (a.kategoria === 'Manipulant' && b.kategoria !== 'Manipulant') return -1;
      if (a.kategoria !== 'Manipulant' && b.kategoria === 'Manipulant') return 1;

      // Drvič hneď za manipulantmi
      if (a.kategoria === 'Drvič' && b.kategoria !== 'Drvič') return -1;
      if (a.kategoria !== 'Drvič' && b.kategoria === 'Drvič') return 1;

      return a.name.localeCompare(b.name);
    });
  };

  const isMovedFromNightShift = (operator: Operator) => {
    return operator.zmena === getShiftLetter('Nočná zmena') && !operator.nocne;
  };

  const isMurarovaMovedToAfternoon = (operator: Operator) => {
    return operator.name === 'Murárová' && operator.zmena === getShiftLetter('Nočná zmena') && !operator.nocne;
  };

  const handleOperatorClick = (operator: Operator) => {
    setSelectedOperator(operator);
    setShowOperatorModal(true);
  };

  // Pomocná funkcia pre konverziu ID
  const parseEmployeeId = (employeeId: number | string) => {
    const isString = typeof employeeId === 'string';
    const isVZ = isString && employeeId.startsWith('vz-');
    const dbId = isString ? parseInt(employeeId.split('-')[1]) : employeeId;
    const employeeType = isVZ ? 'vzzorman' : 'zamestnanci';
    
    return {
      dbId, 
      employeeType,
      isVZ,
      originalId: employeeId
    };
  };

  // Pomocná funkcia pre porovnávanie dátumov
  const isDateInRange = (date: Date, startDate: Date, endDate: Date) => {
    const checkDate = new Date(date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Nastavíme čas na poludnie pre presnejšie porovnanie
    checkDate.setHours(12, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    return checkDate >= start && checkDate <= end;
  };

  // Hlavná funkcia pre získanie absencií zamestnanca
  const getEmployeeAbsences = (employeeId: number | string) => {
    const { dbId, employeeType } = parseEmployeeId(employeeId);
    
    console.log('getEmployeeAbsences - input:', { 
      employeeId, 
        dbId, 
      employeeType 
    });
    
    const result = absences.filter(a => 
      a.employee_id === dbId && 
      a.employee_type === employeeType
    );
    
    console.log('getEmployeeAbsences - result:', result);
    return result;
  };

  // Funkcia pre kontrolu, či je dátum v absencii
  const isDateInAbsence = (employeeId: number | string, date: Date) => {
    const employeeAbsences = getEmployeeAbsences(employeeId);
    
    return employeeAbsences.some(absence => 
      isDateInRange(
        date,
        new Date(absence.datum_od),
        new Date(absence.datum_do)
      )
    );
  };

  // Funkcia pre získanie informácií o absenciách v týždni
  const getAbsenceInfo = (employeeId: number | string, date: Date) => {
    const employeeAbsences = getEmployeeAbsences(employeeId);
      
      // Nastavíme začiatok týždňa na pondelok
    const weekStart = new Date(date);
      const dayOfWeek = weekStart.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekStart.setDate(date.getDate() + diff);
    
    // Nastavíme koniec týždňa
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weekAbsences = employeeAbsences.filter(absence => {
      const absenceStart = new Date(absence.datum_od);
      const absenceEnd = new Date(absence.datum_do);
      
      return (
        isDateInRange(absenceStart, weekStart, weekEnd) ||
        isDateInRange(absenceEnd, weekStart, weekEnd) ||
        isDateInRange(weekStart, absenceStart, absenceEnd)
      );
    });

    if (weekAbsences.length > 0) {
      return weekAbsences.map(absence => ({
        dates: `(${format(new Date(absence.datum_od), 'dd.MM')}-${format(new Date(absence.datum_do), 'dd.MM')})`,
        type: absence.typ_absencie
      }));
    }
    return null;
  };

  // Funkcia pre získanie absencií podľa mesiaca
  const getAbsencesByMonth = (employeeId: number | string) => {
    const employeeAbsences = getEmployeeAbsences(employeeId);
    const absencesByMonth: { [key: string]: Absence[] } = {};
    
    employeeAbsences.forEach(absence => {
      const month = format(new Date(absence.datum_od), 'yyyy-MM');
      if (!absencesByMonth[month]) {
        absencesByMonth[month] = [];
      }
      absencesByMonth[month].push(absence);
    });
    
    return absencesByMonth;
  };

  const getAbsenceIcon = (type: 'dovolenka' | 'pn' | '§' | 'LS' | 'neratat') => {
    switch (type) {
      case 'dovolenka':
        return <><PiIsland className="absence-icon" /> D</>;
      case 'pn':
        return <><FaHeartbeat className="absence-icon" /> PN</>;
      case '§':
        return <><GoLog className="absence-icon" /> §</>;
      case 'LS':
        return <><FaHeartbeat className="absence-icon" /> LS</>;
      case 'neratat':
        return <><FaBan className="absence-icon" /> -</>;
      default:
        return null;
    }
  };

  const getAbsenceStyle = (type: 'dovolenka' | 'pn' | '§' | 'LS' | 'neratat') => {
    return {
      className: `absence-info ${type}`
    };
  };

  const renderAbsenceInfo = (absenceInfo: { dates: string; type: 'dovolenka' | 'pn' | '§' | 'LS' | 'neratat' }[]) => {
    return (
      <div className="absence-info-container">
        {absenceInfo.map((info, index) => (
          <div key={index} className={`absence-info ${info.type}`}>
            {getAbsenceIcon(info.type)}
            <span className="absence-dates">{info.dates}</span>
          </div>
        ))}
      </div>
    );
  };

  const handleRemoveTemporaryOperator = async (operatorId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from('temporary_operators')
        .delete()
        .eq('id', operatorId);

      if (error) throw error;

      setTemporaryOperators(prev => prev.filter(op => op.id !== operatorId));
    } catch (err: any) {
      console.error('Chyba pri odstraňovaní dočasného operátora:', err);
      alert('Nepodarilo sa odstrániť dočasného operátora. Skúste to znova.');
    }
  };

  const renderOperatorCell = (operator: Operator, date: Date, index: number) => {
    const isAbsent = isDateInAbsence(operator.id, date);
    const absenceInfo = isAbsent ? getAbsenceInfo(operator.id, date) : null;
    
    console.log('Rendering operator cell:', { 
      operatorId: operator.id, 
      operatorName: operator.name,
      date: date.toISOString(), 
      isAbsent, 
      absenceInfo,
      absences: absences.filter(a => a.employee_id === (typeof operator.id === 'string' ? parseInt(operator.id.split('-')[1]) : operator.id))
    });
    
    const isMoved = isMovedFromNightShift(operator);
    const isMurarovaMoved = isMurarovaMovedToAfternoon(operator);
    const isTemporary = typeof operator.id === 'string' && operator.id.startsWith('temp-');
    const isManipulant = operator.kategoria === 'Manipulant';
    const isDrvic = operator.kategoria === 'Drvič';
    
    const tempOperator = isTemporary ? 
      temporaryOperators.find(temp => temp.id === operator.id) : null;

    return (
      <div
        key={`${operator.id}-${date.toISOString()}`}
        className={`operator-cell ${isAbsent ? 'absent' : ''} ${isMoved ? 'moved' : ''} ${isMurarovaMoved ? 'murarova-moved' : ''} ${isTemporary ? 'temporary' : ''} ${isManipulant ? 'manipulant' : ''} ${isDrvic ? 'drvic' : ''} ${absenceInfo && absenceInfo[0].type === 'neratat' ? 'absence-neratat' : ''}`}
        onClick={() => handleOperatorClick(operator)}
      >
        <div className="operator-name">
          {operator.name}
          {operator.angetura && <span className="angetura-marker">(Ag)</span>}
          {isManipulant && <span className="manipulant-marker">(Manipulant)</span>}
          {isDrvic && <span className="drvic-marker">(Drvič)</span>}
          {isTemporary && tempOperator && (
            <>
              <span className="temporary-marker">
                (D) {tempOperator.dates.map(d => format(new Date(d), 'dd.MM')).join(', ')}
                {!tempOperator.count_in_total && ' (neráta sa)'}
              </span>
              <button 
                className="remove-temp-operator-btn"
                onClick={(e) => handleRemoveTemporaryOperator(operator.id as string, e)}
                title="Odstrániť dočasného operátora"
              >
                ×
              </button>
            </>
          )}
        </div>
        {absenceInfo && absenceInfo.length > 0 && (
          <div className={`absence-info ${absenceInfo[0].type}`}>
            {renderAbsenceInfo(absenceInfo)}
          </div>
        )}
      </div>
    );
  };

  const getOperatorsCountForDate = (operators: Operator[], date: Date, shift: string) => {
    return operators.filter(operator => {
      if (isDateInAbsence(operator.id, date)) {
        return false;
      }

      if (operator.kategoria === 'Manipulant') {
        return false;
      }

      if (operator.kategoria === 'Drvič') {
        return false;
      }

      if (typeof operator.id === 'string' && operator.id.startsWith('temp-')) {
        const tempOperator = temporaryOperators.find(temp => temp.id === operator.id);
        if (!tempOperator) return false;
        
        // Kontrola či je operátor prítomný v daný deň
        const isPresentOnDate = tempOperator.dates.some(tempDate => 
          isSameDay(new Date(tempDate), date)
        );
        
        return isPresentOnDate && (tempOperator.count_in_total ?? true);
      }

      return true;
    }).length;
  };

  const getOperatorsCountByType = (operators: Operator[], date: Date) => {
    const filteredOperators = operators.filter(operator => {
      if (isDateInAbsence(operator.id, date)) {
        return false;
      }

      if (typeof operator.id === 'string' && operator.id.startsWith('temp-')) {
        const tempOperator = temporaryOperators.find(temp => temp.id === operator.id);
        return tempOperator?.count_in_total ?? true;
      }

      return true;
    });

    return {
      kmenovy: filteredOperators.filter(op => !op.angetura).length,
      agentura: filteredOperators.filter(op => op.angetura).length
    };
  };

  const formatDateRange = (startDate: Date, endDate: Date) => {
    return `${format(startDate, 'dd.MM.yyyy')} - ${format(endDate, 'dd.MM.yyyy')}`;
  };

  const [expandedMonths, setExpandedMonths] = useState<{ [key: string]: boolean }>({});

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [month]: !prev[month]
    }));
  };

  const handleAddTemporaryOperator = async (shift: string) => {
    if (!tempOperatorNames[shift].trim()) return;
    
    const normalizedDates = selectedDates.map(date => {
      const utcDate = new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      ));
      return utcDate;
    });
    
    const newTemporaryOperator: TemporaryOperator = {
      id: `temp-${Date.now()}`,
      name: tempOperatorNames[shift],
      shift: shift,
      dates: normalizedDates,
      count_in_total: countInTotal
    };

    try {
      const { error } = await supabase
        .from('temporary_operators')
        .insert({
          id: newTemporaryOperator.id,
          name: newTemporaryOperator.name,
          shift: newTemporaryOperator.shift,
          dates: normalizedDates.map(date => format(date, 'yyyy-MM-dd')),
          count_in_total: newTemporaryOperator.count_in_total,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Detail chyby:', error);
        throw error;
      }

      setTemporaryOperators(prev => [...prev, newTemporaryOperator]);
      setTempOperatorNames(prev => ({...prev, [shift]: ''}));
      setSelectedDates([]);
      setCountInTotal(true);
      setShowDatePicker({show: false, shift: ''});
    } catch (err: any) {
      console.error('Chyba pri pridávaní dočasného operátora:', err);
      alert('Nepodarilo sa pridať dočasného operátora. Skúste to znova.');
    }
  };

  const renderTemporaryOperatorInput = (shift: string) => {
    return (
      <div className="temporary-operator-input">
        <input
          type="text"
          value={tempOperatorNames[shift]}
          onChange={(e) => setTempOperatorNames(prev => ({...prev, [shift]: e.target.value}))}
          placeholder="Meno dočasného operátora"
          className="temp-operator-name-input"
        />
        <button 
          className="add-temp-operator-btn"
          onClick={() => setShowDatePicker({show: true, shift})}
          disabled={!tempOperatorNames[shift].trim()}
        >
          +
        </button>
        {showDatePicker.show && showDatePicker.shift === shift && (
          <div className="date-picker-modal">
            <div className="date-picker-content">
              <h3>Vyberte dni</h3>
              <div className="date-picker-dates">
                {dates.map((date) => (
                  <label key={date.toISOString()} className="date-picker-date">
                    <input
                      type="checkbox"
                      checked={selectedDates.some(d => isSameDay(d, date))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDates(prev => [...prev, date]);
                        } else {
                          setSelectedDates(prev => prev.filter(d => !isSameDay(d, date)));
                        }
                      }}
                    />
                    {format(date, 'dd.MM.yyyy')}
                  </label>
                ))}
              </div>
              <div className="temp-operator-count-option">
                <label>
                  <input
                    type="checkbox"
                    checked={countInTotal}
                    onChange={(e) => setCountInTotal(e.target.checked)}
                  />
                  Rátať do počtu operátorov
                </label>
              </div>
              <div className="date-picker-actions">
                <button 
                  onClick={() => handleAddTemporaryOperator(shift)}
                  disabled={selectedDates.length === 0}
                >
                  Pridať
                </button>
                <button onClick={() => setShowDatePicker({show: false, shift: ''})}>
                  Zrušiť
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    const subscription = supabase
      .channel('temporary_operators_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'temporary_operators' 
        }, 
        async (payload) => {
          const { data, error } = await supabase
            .from('temporary_operators')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && data) {
            const formattedOperators = data.map((op: any) => ({
              ...op,
              dates: op.dates.map((dateStr: string) => new Date(dateStr))
            }));
            setTemporaryOperators(formattedOperators);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    console.log('Aktuálny vybraný dátum:', format(selectedDate, 'dd.MM.yyyy'));
    console.log('Dočasní operátori:', temporaryOperators);
  }, [selectedDate, temporaryOperators]);

  const render8HourSchedule = () => {
    return (
      <div className="schedule-grid">
        <div className="schedule-column">
          <div className="team-header">
            <h3>Ranná zmena ({getShiftLetter('Ranná zmena')})</h3>
          </div>
          <div className="operators-list">
            {getOperatorsForShift('Ranná zmena', selectedDate).map((operator, index) => (
              render8HourOperatorCell(operator, index)
            ))}
          </div>
          {(user?.role === 'admin' || user?.role === 'manager') && renderTemporaryOperatorInput('Ranná zmena')}
          <div className="dates-list">
            {dates.slice(0, 5).map((date) => {
              const operators = getOperatorsForShift('Ranná zmena', date);
              const availableOperators = getOperatorsCountForDate(operators, date, 'Ranná zmena');
              return (
                <div key={`morning-date-${date.toISOString()}`} className="date-item">
                  <span>{format(date, 'dd.MM.yyyy')}</span>
                  <span 
                    className="operator-count"
                    onClick={() => setShowCountModal({show: true, date, shift: 'Ranná zmena'})}
                    style={{ cursor: 'pointer' }}
                  >
                    {availableOperators} operátorov
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="schedule-column">
          <div className="team-header">
            <h3>Poobedná zmena ({getShiftLetter('Poobedná zmena')})</h3>
          </div>
          <div className="operators-list">
            {getOperatorsForShift('Poobedná zmena', selectedDate).map((operator, index) => (
              render8HourOperatorCell(operator, index)
            ))}
          </div>
          {(user?.role === 'admin' || user?.role === 'manager') && renderTemporaryOperatorInput('Poobedná zmena')}
          <div className="dates-list">
            {dates.slice(0, 5).map((date) => {
              const operators = getOperatorsForShift('Poobedná zmena', date);
              const availableOperators = getOperatorsCountForDate(operators, date, 'Poobedná zmena');
              return (
                <div key={`afternoon-date-${date.toISOString()}`} className="date-item">
                  <span>{format(date, 'dd.MM.yyyy')}</span>
                  <span 
                    className="operator-count"
                    onClick={() => setShowCountModal({show: true, date, shift: 'Poobedná zmena'})}
                    style={{ cursor: 'pointer' }}
                  >
                    {availableOperators} operátorov
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="schedule-column">
          <div className="team-header">
            <h3>Nočná zmena ({getShiftLetter('Nočná zmena')})</h3>
          </div>
          <div className="operators-list">
            {getOperatorsForShift('Nočná zmena', selectedDate).map((operator, index) => (
              render8HourOperatorCell(operator, index)
            ))}
          </div>
          {(user?.role === 'admin' || user?.role === 'manager') && renderTemporaryOperatorInput('Nočná zmena')}
          <div className="dates-list">
            {dates.slice(0, 5).map((date) => {
              const operators = getOperatorsForShift('Nočná zmena', date);
              const availableOperators = getOperatorsCountForDate(operators, date, 'Nočná zmena');
              return (
                <div key={`night-date-${date.toISOString()}`} className="date-item">
                  <span>{format(date, 'dd.MM.yyyy')}</span>
                  <span 
                    className="operator-count"
                    onClick={() => setShowCountModal({show: true, date, shift: 'Nočná zmena'})}
                    style={{ cursor: 'pointer' }}
                  >
                    {availableOperators} operátorov
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="schedule-column">
          <div className="team-header">
            <h3>Od 7:00 ranná (O)</h3>
          </div>
          <div className="operators-list">
            {getOperatorsForShift('Od 7:00 ranná', selectedDate).map((operator, index) => (
              render8HourOperatorCell(operator, index)
            ))}
          </div>
          {(user?.role === 'admin' || user?.role === 'manager') && renderTemporaryOperatorInput('Od 7:00 ranná')}
          <div className="dates-list">
            {dates.slice(0, 5).map((date) => {
              const operatorsForDate = getOperatorsForShift('Od 7:00 ranná', date);
              const availableOperators = getOperatorsCountForDate(operatorsForDate, date, 'Od 7:00 ranná');
              return (
                <div key={`early-date-${date.toISOString()}`} className="date-item">
                  <span>{format(date, 'dd.MM.yyyy')}</span>
                  <span 
                    className="operator-count"
                    onClick={() => setShowCountModal({show: true, date, shift: 'Od 7:00 ranná'})}
                    style={{ cursor: 'pointer' }}
                  >
                    {availableOperators} operátorov
                  </span>
                </div>
              );
            })}
          </div>
          {/* Box pre všetkých zamestnancov na materskej dovolenke (bez ohľadu na zmenu) */}
          <div style={{marginTop: '0.5em', background: 'rgba(255,193,7,0.13)', borderRadius: 8, padding: '0.5em 0.8em', fontSize: '0.97em', color: '#ffd54f', minHeight: 24}}>
            <div style={{fontWeight: 600, color: '#ffd54f', marginBottom: 2}}>Materská dovolenka:</div>
            {operators.filter(op => op.materska).length === 0 ? (
              <span style={{color: '#aaa'}}>Žiadny zamestnanec</span>
            ) : (
              operators.filter(op => op.materska).map(op => (
                <span key={op.id} style={{display: 'inline-block', marginRight: 8, marginBottom: 2, background: '#ffd54f33', color: '#ffd54f', borderRadius: 6, padding: '2px 8px', fontWeight: 600}}>
                  {op.name} <span style={{fontSize: '0.85em', background: '#ffd54f', color: '#222', borderRadius: 4, padding: '0 6px', marginLeft: 4}}>MD</span>
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTwelveHourOperatorCell = (operator: Operator, date: string) => {
    const isAbsent = isDateInAbsence(operator.id, new Date(date));
    const absenceInfo = isAbsent ? getAbsenceInfo(operator.id, new Date(date)) : null;
    const isVeduci = operator.zmena.startsWith('VZ');

    return (
      <div 
        style={{display: 'flex', alignItems: 'center', gap: '4px', padding: '0'}}
        className={absenceInfo && absenceInfo[0].type === 'neratat' ? 'absence-neratat' : ''}
      >
        <span className="operator-name" style={{fontSize: '1em'}}>
          {operator.name}
          {isVeduci && <span className="veduci-marker">(VZ)</span>}
        </span>
        {absenceInfo && (
          <div className={`absence-info ${absenceInfo[0].type}`} style={{marginLeft: '4px'}}>
            {renderAbsenceInfo(absenceInfo)}
          </div>
        )}
      </div>
    );
  };

  // Nová funkcia pre 8-hodinový harmonogram - zobrazuje absencie pre celý týždeň
  const render8HourOperatorCell = (operator: Operator, index: number) => {
    // Kontrolujeme absencie pre celý týždeň, nie len pre pondelok
    const weekAbsences = dates.map(date => {
      const isAbsent = isDateInAbsence(operator.id, date);
      return isAbsent ? getAbsenceInfo(operator.id, date) : null;
    }).filter(Boolean);

    const isMoved = isMovedFromNightShift(operator);
    const isMurarovaMoved = isMurarovaMovedToAfternoon(operator);
    const isTemporary = typeof operator.id === 'string' && operator.id.startsWith('temp-');
    const isManipulant = operator.kategoria === 'Manipulant';
    const isDrvic = operator.kategoria === 'Drvič';
    
    const tempOperator = isTemporary ? 
      temporaryOperators.find(temp => temp.id === operator.id) : null;

    // Zistíme, či má operátor nejaké absencie v týždni
    const hasAbsences = weekAbsences.length > 0;
    const absenceType = hasAbsences ? weekAbsences[0][0].type : null;

    return (
      <div
        key={`${operator.id}-${index}`}
        className={`operator-cell ${hasAbsences ? 'absent' : ''} ${isMoved ? 'moved' : ''} ${isMurarovaMoved ? 'murarova-moved' : ''} ${isTemporary ? 'temporary' : ''} ${isManipulant ? 'manipulant' : ''} ${isDrvic ? 'drvic' : ''} ${absenceType === 'neratat' ? 'absence-neratat' : ''}`}
        onClick={() => handleOperatorClick(operator)}
      >
        <div className="operator-name">
          {operator.name}
          {operator.angetura && <span className="angetura-marker">(Ag)</span>}
          {isManipulant && <span className="manipulant-marker">(Manipulant)</span>}
          {isDrvic && <span className="drvic-marker">(Drvič)</span>}
          {isTemporary && tempOperator && (
            <>
              <span className="temporary-marker">
                (D) {tempOperator.dates.map(d => format(new Date(d), 'dd.MM')).join(', ')}
                {!tempOperator.count_in_total && ' (neráta sa)'}
              </span>
              <button 
                className="remove-temp-operator-btn"
                onClick={(e) => handleRemoveTemporaryOperator(operator.id as string, e)}
                title="Odstrániť dočasného operátora"
              >
                ×
              </button>
            </>
          )}
        </div>
        {hasAbsences && (
          <div className={`absence-info ${absenceType}`}>
            {renderAbsenceInfo(weekAbsences[0])}
          </div>
        )}
      </div>
    );
  };

  const renderVZAbsence = (vz: VZEmployee, date: string) => {
    const isAbsent = isDateInAbsence(`vz-${vz.id}`, new Date(date));
    const absenceInfo = isAbsent ? getAbsenceInfo(`vz-${vz.id}`, new Date(date)) : null;

    return (
      <>
        {absenceInfo && (
          <div className={`absence-info ${absenceInfo[0].type}`}>
            {renderAbsenceInfo(absenceInfo)}
          </div>
        )}
      </>
    );
  };

  const handleDeputyClick = (position: string, team: string, date: Date) => {
    if (!canManageDeputies) return;
    setShowDeputyModal({show: true, position, team, date});
    setDeputyName('');
  };

  const handleAddDeputy = async () => {
    if (!deputyName.trim() || !showDeputyModal) return;

    if (!canManageDeputies) {
      alert('Nemáte oprávnenie na pridanie zástupcu.');
      return;
    }

    const newDeputy: Deputy = {
      id: `deputy-${Date.now()}`,
      name: showDeputyModal.position === 'VZ' ? 
        veduciZmeny.find(vz => vz.pozicia === `VZ${showDeputyModal.team}`)?.meno || '' :
        zoradovaci.find(z => z.pozicia === `Zoradovac${showDeputyModal.team}`)?.meno || '',
      position: showDeputyModal.position,
      team: showDeputyModal.team,
      date: showDeputyModal.date,
      deputy_name: deputyName.trim()
    };

    try {
      const { error } = await supabase
        .from('deputies')
        .insert({
          id: newDeputy.id,
          name: newDeputy.name,
          position: newDeputy.position,
          team: newDeputy.team,
          date: format(newDeputy.date, 'yyyy-MM-dd'),
          deputy_name: newDeputy.deputy_name,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      setDeputies(prev => [...prev, newDeputy]);
      setShowDeputyModal(null);
      setDeputyName('');
    } catch (err: any) {
      console.error('Chyba pri pridávaní zástupu:', err);
      alert('Nepodarilo sa pridať zástup. Skúste to znova.');
    }
  };

  const handleRemoveDeputy = async (deputyId: string) => {
    if (!canManageDeputies) {
      alert('Nemáte oprávnenie na odstránenie zástupcu.');
      return;
    }
    try {
      const { error } = await supabase
        .from('deputies')
        .delete()
        .eq('id', deputyId);

      if (error) throw error;

      setDeputies(prev => prev.filter(d => d.id !== deputyId));
    } catch (err: any) {
      console.error('Chyba pri odstraňovaní zástupu:', err);
      alert('Nepodarilo sa odstrániť zástup. Skúste to znova.');
    }
  };

  useEffect(() => {
    const fetchDeputies = async () => {
      try {
        const { data, error } = await supabase
          .from('deputies')
          .select('*')
          .gte('date', format(getWeekDates(selectedDate)[0], 'yyyy-MM-dd'))
          .lte('date', format(getWeekDates(selectedDate)[6], 'yyyy-MM-dd'));

        if (error) throw error;

        const formattedDeputies = data.map((d: any) => ({
          ...d,
          date: new Date(d.date)
        }));

        setDeputies(formattedDeputies);
      } catch (err: any) {
        console.error('Chyba pri načítaní zástupov:', err);
      }
    };

    fetchDeputies();
  }, [selectedDate]);

  const render12HourSchedule = () => {
    const weekDates = getWeekDates(selectedDate);
    const daysSk = ['pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota', 'nedeľa'];
    const teamStartDates: Record<string, Date> = {
      B12: new Date('2025-04-14'),
      D12: new Date('2025-04-15'),
      A12: new Date('2025-04-16'),
      C12: new Date('2025-04-17'),
    };
    const zoradovacStartDates: Record<string, { date: Date, shift: 'ranna' | 'nocna' }> = {
      'D12': { date: new Date('2025-04-15'), shift: 'ranna' },
      'B12': { date: new Date('2025-04-15'), shift: 'nocna' },
      'A12': { date: new Date('2025-04-17'), shift: 'ranna' },
      'C12': { date: new Date('2025-04-17'), shift: 'nocna' }
    };
    const cycle = ['ranna', 'nocna', 'volno', 'volno', 'ranna', 'nocna', 'volno', 'volno'];
    const zoradovacCycle = ['ranna', 'ranna', 'volno', 'volno', 'nocna', 'nocna', 'volno', 'volno'];
    const teams = ['A12', 'B12', 'C12', 'D12'];
    
    return (
      <>
      <div className="schedule-grid twelve-hour-schedule-grid" style={{gridTemplateColumns: 'repeat(7, 1fr)'}}>
        {weekDates.map((date, idx) => {
          let morningTeams: string[] = [];
          let nightTeams: string[] = [];
            let morningZoradovaci: string[] = [];
            let nightZoradovaci: string[] = [];

          teams.forEach(team => {
            const diffDays = Math.floor((date.getTime() - teamStartDates[team].getTime()) / (1000 * 60 * 60 * 24));
            const cycleDay = ((diffDays % 8) + 8) % 8;
            if (cycle[cycleDay] === 'ranna') morningTeams.push(team);
            if (cycle[cycleDay] === 'nocna') nightTeams.push(team);
          });

            // Špeciálna logika pre zoraďovačov
            teams.forEach(team => {
              const startInfo = zoradovacStartDates[team];
              const diffDays = Math.floor((date.getTime() - startInfo.date.getTime()) / (1000 * 60 * 60 * 24));
              
              // Pre každý tím nastavíme offset podľa jeho začiatku
              let cycleOffset = 0;
              if (team === 'D12') cycleOffset = 0;  // začína rannou 15.4.
              if (team === 'B12') cycleOffset = 4;  // začína nočnou 15.4.
              if (team === 'A12') cycleOffset = 0;  // začína rannou 17.4.
              if (team === 'C12') cycleOffset = 4;  // začína nočnou 17.4.
              
              const cycleDay = ((diffDays + cycleOffset) % 8 + 8) % 8;
              
              if (zoradovacCycle[cycleDay] === 'ranna') morningZoradovaci.push(team);
              if (zoradovacCycle[cycleDay] === 'nocna') nightZoradovaci.push(team);
            });
            
            const morningOps = operators.filter(op => {
              const team = op.zmena.startsWith('VZ') ? op.zmena.replace('VZ', '') : op.zmena;
              return morningTeams.includes(team);
            });

            const morningVeduci = veduciZmeny.filter(vz => {
              const team = vz.pozicia.replace('VZ', '');
              return morningTeams.includes(team);
            });

            const morningZoradovaciOps = zoradovaci.filter(z => {
              const team = z.pozicia.replace('Zoradovac', '');
              return morningZoradovaci.includes(team);
            });
            
            const nightOps = operators.filter(op => {
              const team = op.zmena.startsWith('VZ') ? op.zmena.replace('VZ', '') : op.zmena;
              return nightTeams.includes(team);
            });

            const nightVeduci = veduciZmeny.filter(vz => {
              const team = vz.pozicia.replace('VZ', '');
              return nightTeams.includes(team);
            });

            const nightZoradovaciOps = zoradovaci.filter(z => {
              const team = z.pozicia.replace('Zoradovac', '');
              return nightZoradovaci.includes(team);
            });
            
          const morningOpsPresent = morningOps.filter(op => !isDateInAbsence(op.id, date));
          const nightOpsPresent = nightOps.filter(op => !isDateInAbsence(op.id, date));
            
            // Pridáme dočasných operátorov do počtu ak majú nastavené count_in_total
            const morningTempOps = temporaryOperators.filter(temp => {
              if (temp.shift !== 'Ranná zmena') return false;
              if (!temp.count_in_total) return false;
              return temp.dates.some(tempDate => isSameDay(new Date(tempDate), date));
            });

            const nightTempOps = temporaryOperators.filter(temp => {
              if (temp.shift !== 'Nočná zmena') return false;
              if (!temp.count_in_total) return false;
              return temp.dates.some(tempDate => isSameDay(new Date(tempDate), date));
            });

          return (
            <div key={date.toISOString()} className="schedule-column">
              <div className="date-header">
                <h3>{daysSk[idx]}</h3>
                <span>{format(date, 'dd.MM.yyyy')}</span>
              </div>
              <div className="shift-sections">
                <div className="shift-section">
                  <div className="shift-label">
                    Ranná <span style={{color:'#888', fontWeight:400}}>({morningTeams.length > 0 ? morningTeams.join(', ') : '–'})</span>
                    {(user?.role === 'admin' || user?.role === 'manager') && (
                      <span
                        onClick={() => {
                          setSelectedDates([date]); // Automaticky vyberieme aktuálny deň
                          setShowDatePicker({show: true, shift: 'Ranná zmena'});
                        }}
                        style={{
                          marginLeft: '4px',
                          color: '#4CAF50',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        +
                      </span>
                    )}
                  </div>
                  <div className="operators-list" style={{gap: '0', padding: '0'}}>
                    {morningVeduci.map((vz: VZEmployee) => {
                      const isAbsent = isDateInAbsence(vz.id, date);
                      const absenceInfo = isAbsent ? getAbsenceInfo(vz.id, date) : null;
                      const deputy = deputies.find(d => 
                        d.position === 'VZ' && 
                        d.team === vz.pozicia.replace('VZ', '') && 
                        isSameDay(d.date, date)
                      );
                      return (
                        <div 
                          key={vz.id} 
                          style={{display: 'flex', alignItems: 'center', gap: '4px', padding: '0', cursor: 'pointer'}}
                          onClick={() => handleDeputyClick('VZ', vz.pozicia.replace('VZ', ''), date)}
                        >
                          <span className="operator-name" style={{fontSize: '1em'}}>
                            {vz.meno}
                            {deputy && (
                              <>
                                <span style={{color: '#00ff00'}}>/{deputy.deputy_name}</span>
                                {canManageDeputies && (
                                <button 
                                  className="remove-deputy-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveDeputy(deputy.id);
                                  }}
                                  style={{marginLeft: '4px', padding: '0 4px'}}
                        >
                                  ×
                                </button>
                                )}
                              </>
                            )}
                            <span className="veduci-marker">(VZ)</span>
                        </span>
                        {absenceInfo && (
                            <div className={`absence-info ${absenceInfo[0].type}`} style={{marginLeft: '4px'}}>
                              {renderAbsenceInfo(absenceInfo)}
                            </div>
                        )}
                        </div>
                    );
                  })}
                    {morningZoradovaciOps.map((z: VZEmployee) => {
                      const isAbsent = isDateInAbsence(z.id, date);
                      const absenceInfo = isAbsent ? getAbsenceInfo(z.id, date) : null;
                      const deputy = deputies.find(d => 
                        d.position === 'Z' && 
                        d.team === z.pozicia.replace('Zoradovac', '') && 
                        isSameDay(d.date, date)
                      );
                      return (
                        <div 
                          key={z.id} 
                          style={{display: 'flex', alignItems: 'center', gap: '4px', padding: '0', cursor: 'pointer'}}
                          onClick={() => handleDeputyClick('Z', z.pozicia.replace('Zoradovac', ''), date)}
                        >
                          <span className="operator-name" style={{fontSize: '1em', color: '#ffd700'}}>
                            {z.meno}
                            {deputy && (
                              <>
                                <span style={{color: '#00ff00'}}>/{deputy.deputy_name}</span>
                                {canManageDeputies && (
                                <button 
                                  className="remove-deputy-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveDeputy(deputy.id);
                                  }}
                                  style={{marginLeft: '4px', padding: '0 4px'}}
                                >
                                  ×
                                </button>
                                )}
                              </>
                            )}
                            <span style={{color: '#ffd700', fontSize: '0.9em', marginLeft: '4px'}}>(Z)</span>
                          </span>
                          {absenceInfo && (
                            <div className={`absence-info ${absenceInfo[0].type}`} style={{marginLeft: '4px'}}>
                              {renderAbsenceInfo(absenceInfo)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {morningOps.map((op) => (
                      <div key={op.id} style={{display: 'flex', alignItems: 'center', gap: '4px', padding: '0'}}>
                        <span className="operator-name" style={{fontSize: '1em'}}>
                          {op.name}
                          {op.angetura && <span className="angetura-marker">(Ag)</span>}
                        </span>
                        {renderAbsenceIcon(op.id, date)}
                      </div>
                    ))}
                    {morningTempOps.map((temp) => (
                      <div key={temp.id} style={{display: 'flex', alignItems: 'center', gap: '4px', padding: '0'}}>
                        <span className="operator-name" style={{fontSize: '1em', color: '#ff69b4'}}>
                          {temp.name}
                          <span style={{color: '#ff69b4', fontSize: '0.9em', marginLeft: '4px'}}>(D)</span>
                          <button 
                            className="remove-temp-operator-btn"
                            onClick={(e) => handleRemoveTemporaryOperator(temp.id, e)}
                            style={{marginLeft: '4px', padding: '0 4px'}}
                          >
                            ×
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="shift-counts" style={{marginTop: 2, textAlign: 'center', fontSize: '0.95em', color: '#ffffff', fontWeight: 600}}>
                    Počet: {morningOpsPresent.length + morningTempOps.length} operátorov
                </div>
                </div>
                <div className="shift-section">
                  <div className="shift-label">
                    Nočná <span style={{color:'#888', fontWeight:400}}>({nightTeams.length > 0 ? nightTeams.join(', ') : '–'})</span>
                    {(user?.role === 'admin' || user?.role === 'manager') && (
                      <span
                        onClick={() => {
                          setSelectedDates([date]); // Automaticky vyberieme aktuálny deň
                          setShowDatePicker({show: true, shift: 'Nočná zmena'});
                        }}
                        style={{
                          marginLeft: '4px',
                          color: '#4CAF50',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        +
                      </span>
                    )}
                  </div>
                  <div className="operators-list" style={{gap: '0', padding: '0'}}>
                    {nightVeduci.map((vz: VZEmployee) => {
                      const isAbsent = isDateInAbsence(vz.id, date);
                      const absenceInfo = isAbsent ? getAbsenceInfo(vz.id, date) : null;
                      const deputy = deputies.find(d => 
                        d.position === 'VZ' && 
                        d.team === vz.pozicia.replace('VZ', '') && 
                        isSameDay(d.date, date)
                      );
                      return (
                        <div 
                          key={vz.id} 
                          style={{display: 'flex', alignItems: 'center', gap: '4px', padding: '0', cursor: 'pointer'}}
                          onClick={() => handleDeputyClick('VZ', vz.pozicia.replace('VZ', ''), date)}
                        >
                          <span className="operator-name veduci-zmeny" style={{fontSize: '1em'}}>
                            {vz.meno}
                            {deputy && (
                              <>
                                <span style={{color: '#00ff00'}}>/{deputy.deputy_name}</span>
                                {canManageDeputies && (
                                <button 
                                  className="remove-deputy-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveDeputy(deputy.id);
                                  }}
                                  style={{marginLeft: '4px', padding: '0 4px'}}
                        >
                                  ×
                                </button>
                                )}
                              </>
                            )}
                            <span className="veduci-marker">(VZ)</span>
                        </span>
                        {absenceInfo && (
                            <div className={`absence-info ${absenceInfo[0].type}`} style={{marginLeft: '4px'}}>
                              {renderAbsenceInfo(absenceInfo)}
                            </div>
                        )}
                        </div>
                    );
                  })}
                    {nightZoradovaciOps.map((z: VZEmployee) => {
                      const isAbsent = isDateInAbsence(z.id, date);
                      const absenceInfo = isAbsent ? getAbsenceInfo(z.id, date) : null;
                      const deputy = deputies.find(d => 
                        d.position === 'Z' && 
                        d.team === z.pozicia.replace('Zoradovac', '') && 
                        isSameDay(d.date, date)
                      );
                      return (
                        <div 
                          key={z.id} 
                          style={{display: 'flex', alignItems: 'center', gap: '4px', padding: '0', cursor: 'pointer'}}
                          onClick={() => handleDeputyClick('Z', z.pozicia.replace('Zoradovac', ''), date)}
                        >
                          <span className="operator-name" style={{fontSize: '1em', color: '#ffd700'}}>
                            {z.meno}
                            {deputy && (
                              <>
                                <span style={{color: '#00ff00'}}>/{deputy.deputy_name}</span>
                                {canManageDeputies && (
                                <button 
                                  className="remove-deputy-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveDeputy(deputy.id);
                                  }}
                                  style={{marginLeft: '4px', padding: '0 4px'}}
                                >
                                  ×
                                </button>
                                )}
                              </>
                            )}
                            <span style={{color: '#ffd700', fontSize: '0.9em', marginLeft: '4px'}}>(Z)</span>
                          </span>
                          {absenceInfo && (
                            <div className={`absence-info ${absenceInfo[0].type}`} style={{marginLeft: '4px'}}>
                              {renderAbsenceInfo(absenceInfo)}
                            </div>
                          )}
                </div>
                        );
                      })}
                      {nightOps.map((op: Operator) => (
                        <div key={op.id}>
                          {renderTwelveHourOperatorCell(op, date.toISOString())}
                        </div>
                      ))}
                      {nightTempOps.map((temp: TemporaryOperator) => (
                        <div key={temp.id} style={{display: 'flex', alignItems: 'center', gap: '4px', padding: '0'}}>
                          <span className="operator-name" style={{fontSize: '1em', color: '#ff69b4'}}>
                            {temp.name}
                            <span style={{color: '#ff69b4', fontSize: '0.9em', marginLeft: '4px'}}>(D)</span>
                            <button 
                              className="remove-temp-operator-btn"
                              onClick={(e) => handleRemoveTemporaryOperator(temp.id, e)}
                              style={{marginLeft: '4px', padding: '0 4px'}}
                            >
                              ×
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="shift-counts" style={{marginTop: 2, textAlign: 'center', fontSize: '0.95em', color: '#ffffff', fontWeight: 600}}>
                      Počet: {nightOpsPresent.length + nightTempOps.length} operátorov
                    </div>
                  </div>
              </div>
            </div>
          );
        })}
      </div>
      {showDatePicker.show && (user?.role === 'admin' || user?.role === 'manager') && (
        <div className="date-picker-modal">
          <div className="date-picker-content">
            <h3>Pridať dočasného operátora</h3>
            <input
              type="text"
              value={tempOperatorNames[showDatePicker.shift]}
              onChange={(e) => setTempOperatorNames(prev => ({...prev, [showDatePicker.shift]: e.target.value}))}
              placeholder="Meno dočasného operátora"
              className="temp-operator-name-input"
              style={{width: '100%', marginBottom: '10px', padding: '8px'}}
            />
            <div className="temp-operator-count-option">
              <label>
                <input
                  type="checkbox"
                  checked={countInTotal}
                  onChange={(e) => setCountInTotal(e.target.checked)}
                />
                Rátať do počtu operátorov
              </label>
            </div>
            <div className="date-picker-actions">
              <button 
                onClick={() => handleAddTemporaryOperator(showDatePicker.shift)}
                disabled={!tempOperatorNames[showDatePicker.shift].trim()}
              >
                Pridať
              </button>
              <button onClick={() => {
                setShowDatePicker({show: false, shift: ''});
                setSelectedDates([]);
              }}>
                Zrušiť
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  };

  const renderAbsenceIcon = (operatorId: number | string, date: Date) => {
    console.log('renderAbsenceIcon - input:', { operatorId, date });
    const isAbsent = isDateInAbsence(operatorId, date);
    console.log('isAbsent:', isAbsent);
    const absenceInfo = isAbsent ? getAbsenceInfo(operatorId, date) : null;
    console.log('absenceInfo:', absenceInfo);

    return (
      <>
        {absenceInfo && (
          <div className={`absence-info ${absenceInfo[0].type}`} style={{marginLeft: '4px'}}>
            {renderAbsenceInfo(absenceInfo)}
          </div>
        )}
      </>
    );
  };

  const handleDeleteOperator = async (operatorId: number | string) => {
    setShowDeleteConfirm({ show: true, operatorId });
  };

  const handleConfirmDeleteOperator = async () => {
    if (!showDeleteConfirm.operatorId) return;
    try {
      const operatorId = showDeleteConfirm.operatorId;
      const dbId = typeof operatorId === 'string' ? parseInt(operatorId.split('-')[1]) : operatorId;
      const employeeType = typeof operatorId === 'string' && operatorId.startsWith('vz-') ? 'vzzorman' : 'zamestnanci';
      const { error } = await supabase
        .from(employeeType)
        .delete()
        .eq('id', dbId);
      if (error) throw error;
      setOperators(prev => prev.filter(op => op.id !== operatorId));
      setShowOperatorModal(false);
      setSelectedOperator(null);
      setShowDeleteConfirm({ show: false, operatorId: null });
    } catch (err: any) {
      console.error('Chyba pri mazaní zamestnanca:', err);
      alert('Nepodarilo sa vymazať zamestnanca. Skúste to znova.');
      setShowDeleteConfirm({ show: false, operatorId: null });
    }
  };

  const handleCancelDeleteOperator = () => {
    setShowDeleteConfirm({ show: false, operatorId: null });
  };

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('rozvrh')
        .select('*')
        .order('datum', { ascending: true });

      if (scheduleError) throw scheduleError;

      const { data: employeesData, error: employeesError } = await supabase
        .from('zamestnanci')
        .select('*')
        .order('meno');

      if (employeesError) throw employeesError;

      const { data: vzzormanData, error: vzzormanError } = await supabase
        .from('vzzorman')
        .select('*')
        .order('meno');

      if (vzzormanError) throw vzzormanError;

      const { data: absencesData, error: absencesError } = await supabase
        .from('absencie')
        .select('*')
        .order('datum_od', { ascending: true });

      if (absencesError) throw absencesError;

      setOperators(scheduleData || []);
      setAbsences(absencesData || []);
    } catch (error) {
      console.error('Chyba pri načítaní dát:', error);
    } finally {
      setLoading(false);
    }
  };

  function getInputWeekValue(date: Date) {
    const year = date.getFullYear();
    const week = getISOWeek(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  if (loading) return <div>Načítavam...</div>;
  if (error) return <div>Chyba: {error}</div>;

  return (
    <div className="schedule-page">
      <div className="schedule-header">
        <h1>Harmonogram - Týždeň {getWeekNumber(selectedDate)} ({format(selectedDate, 'dd.MM.yyyy', { locale: sk })})</h1>
        <div className="schedule-controls">
          <div className="schedule-type-switch">
            <button 
              className={`switch-button ${!is12HourSchedule ? 'active' : ''}`}
              onClick={() => setIs12HourSchedule(false)}
            >
              8-hodinový
            </button>
            <button 
              className={`switch-button ${is12HourSchedule ? 'active' : ''}`}
              onClick={() => setIs12HourSchedule(true)}
            >
              12-hodinový
            </button>
          </div>
          <input
            type="week"
            className="native-week-picker"
            value={getInputWeekValue(currentDate)}
            onChange={e => {
              const value = e.target.value; // napr. '2024-W24'
              if (value) {
                const [year, week] = value.split('-W');
                // Referenčný pondelok
                const referenceMonday = new Date('2025-04-14');
                // Vypočítaj pondelok daného týždňa podľa referenčného pondelka
                const selectedMonday = new Date(referenceMonday);
                selectedMonday.setDate(referenceMonday.getDate() + (Number(week) - getISOWeek(referenceMonday) + (Number(year) - referenceMonday.getFullYear()) * 52) * 7);
                handleDateChange(selectedMonday);
              }
            }}
            style={{
              background: '#101828',
              color: '#fff',
              border: '1.5px solid var(--primary-color)',
              borderRadius: '8px',
              padding: '0.4em 1em',
              fontSize: '1.08rem',
              marginTop: '0.7em',
              outline: 'none',
              width: 'auto',
              minWidth: '160px',
              maxWidth: '220px',
              textAlign: 'center',
            }}
          />
        </div>
      </div>

      {is12HourSchedule ? render12HourSchedule() : render8HourSchedule()}

      {showOperatorModal && selectedOperator && (
        <div className="operator-modal-overlay" onClick={() => setShowOperatorModal(false)}>
          <div className="operator-modal" onClick={e => e.stopPropagation()}>
            <div className="operator-modal-header">
              <h2>Informácie o operátorovi</h2>
              <div className="operator-modal-actions">
                {(user?.role === 'admin' || user?.role === 'manager') && (
                  <button 
                    className="operator-delete-btn"
                    onClick={() => handleDeleteOperator(selectedOperator.id)}
                    title="Vymazať zamestnanca"
                  >
                    Vymazať
                  </button>
                )}
              <button className="operator-modal-close" onClick={() => setShowOperatorModal(false)}>×</button>
              </div>
            </div>
            <div className="operator-modal-content">
              <div className="operator-modal-left">
                <div className="operator-info-grid">
                  <div className="operator-info-item">
                    <span className="operator-info-label">Meno</span>
                    <span className="operator-info-value">{selectedOperator.name}</span>
                  </div>
                  <div className="operator-info-item">
                    <span className="operator-info-label">Zmena</span>
                    <span className="operator-info-value">{selectedOperator.zmena}</span>
                  </div>
                  <div className="operator-info-item">
                    <span className="operator-info-label">Kategória</span>
                    <span className="operator-info-value">{selectedOperator.kategoria}</span>
                  </div>
                  <div className="operator-info-item">
                    <span className="operator-info-label">Nočné</span>
                    <span className="operator-info-value">{selectedOperator.nocne ? 'Áno' : 'Nie'}</span>
                  </div>
                  <div className="operator-info-item">
                    <span className="operator-info-label">Začiatok 7:00</span>
                    <span className="operator-info-value">{selectedOperator.zaciatok7 ? 'Áno' : 'Nie'}</span>
                  </div>
                </div>
              </div>
              <div className="operator-modal-right">
                <div className="operator-month-section">
                  <div className="operator-month-header">
                    <span>Absencie v aktuálnom týždni</span>
                  </div>
                  <div className="operator-month-content">
                    <div className="operator-absence-list">
                      {getAbsenceInfo(selectedOperator.id, currentDate)?.map((info, index) => (
                        <div key={`absence-${index}`} className="operator-absence-item">
                          <div className={`operator-absence-type ${info.type}`}>
                            {renderAbsenceInfo([info])}
                          </div>
                          <div className="operator-absence-dates">{info.dates}</div>
                        </div>
                      )) || <div className="operator-absence-item">Žiadne absencie</div>}
                    </div>
                  </div>
                </div>
                <div className="operator-month-section">
                  <div className="operator-month-header">
                    <span>Absencie:</span>
                  </div>
                  <div className="operator-month-content">
                    {Object.entries(getAbsencesByMonth(selectedOperator.id))
                      .sort(([a], [b]) => b.localeCompare(a))
                      .map(([month, monthAbsences]) => (
                        <div key={`month-${month}`} className="operator-month-section">
                          <div 
                            className="operator-month-header"
                            onClick={() => toggleMonth(month)}
                          >
                            <span>{format(new Date(month + '-01'), 'MMMM yyyy', { locale: sk })
                              .replace('apríla', 'april')
                              .replace('mája', 'maj')
                              .replace('júna', 'jun')
                              .replace('júla', 'jul')
                              .replace('augusta', 'august')
                              .replace('septembra', 'september')
                              .replace('októbra', 'oktober')
                              .replace('novembra', 'november')
                              .replace('decembra', 'december')
                              .replace('januára', 'januar')
                              .replace('februára', 'februar')
                              .replace('marca', 'marec')}</span>
                            <span>{expandedMonths[month] ? '▼' : '▶'}</span>
                          </div>
                          {expandedMonths[month] && (
                            <div className="operator-month-content">
                              <div className="operator-absence-list">
                                {monthAbsences.map((absence, index) => (
                                  <div key={`absence-${month}-${index}`} className="operator-absence-item">
                                    <div className={`operator-absence-type ${absence.typ_absencie.toLowerCase()}`}>
                                      {renderAbsenceInfo([{
                                        dates: `(${format(new Date(absence.datum_od), 'dd.MM')}-${format(new Date(absence.datum_do), 'dd.MM')})`,
                                        type: absence.typ_absencie
                                      }])}
                                    </div>
                                    <div className={`operator-absence-dates ${absence.typ_absencie.toLowerCase()}`}>
                                      {formatDateRange(new Date(absence.datum_od), new Date(absence.datum_do))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEmployeeModal !== null && (() => {
        const employee = operators.find(e => e.id === showEmployeeModal);
        if (!employee) return null;
        
        return (
          <div key={`modal-${employee.id}`} className="operator-modal-overlay" onClick={() => setShowEmployeeModal(null)}>
            <div className="operator-modal" onClick={e => e.stopPropagation()}>
              <div className="operator-modal-header">
                <h2>{employee.name}</h2>
                <button className="operator-modal-close" onClick={() => setShowEmployeeModal(null)}>×</button>
              </div>
              <div className="operator-modal-content">
                <div className="operator-modal-left">
                  <div className="operator-info-grid">
                    <div className="operator-info-item">
                      <span className="operator-info-label">Meno</span>
                      <span className="operator-info-value">{employee.name}</span>
                    </div>
                    <div className="operator-info-item">
                      <span className="operator-info-label">Zmena</span>
                      <span className="operator-info-value">{employee.zmena}</span>
                    </div>
                    <div className="operator-info-item">
                      <span className="operator-info-label">Kategória</span>
                      <span className="operator-info-value">{employee.kategoria}</span>
                    </div>
                    <div className="operator-info-item">
                      <span className="operator-info-label">Nočné</span>
                      <span className="operator-info-value">{employee.nocne ? 'Áno' : 'Nie'}</span>
                    </div>
                    <div className="operator-info-item">
                      <span className="operator-info-label">Začiatok 7:00</span>
                      <span className="operator-info-value">{employee.zaciatok7 ? 'Áno' : 'Nie'}</span>
                    </div>
                  </div>
                </div>
                <div className="operator-modal-right">
                  <div className="operator-month-section">
                    <div className="operator-month-header">
                      <span>Absencie v aktuálnom týždni</span>
                    </div>
                    <div className="operator-month-content">
                      <div className="operator-absence-list">
                        {getAbsenceInfo(employee.id, currentDate)?.map((info, index) => (
                          <div key={`absence-${index}`} className="operator-absence-item">
                            <div className={`operator-absence-type ${info.type}`}>
                              {renderAbsenceInfo([info])}
                            </div>
                            <div className="operator-absence-dates">{info.dates}</div>
                          </div>
                        )) || <div className="operator-absence-item">Žiadne absencie</div>}
                      </div>
                    </div>
                  </div>
                  {Object.entries(getAbsencesByMonth(employee.id))
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([month, monthAbsences]) => (
                      <div key={`month-${month}`} className="operator-month-section">
                        <div 
                          className="operator-month-header"
                          onClick={() => toggleMonth(month)}
                        >
                          <span>{format(new Date(month + '-01'), 'MMMM yyyy', { locale: sk })
                            .replace('apríla', 'april')
                            .replace('mája', 'maj')
                            .replace('júna', 'jun')
                            .replace('júla', 'jul')
                            .replace('augusta', 'august')
                            .replace('septembra', 'september')
                            .replace('októbra', 'oktober')
                            .replace('novembra', 'november')
                            .replace('decembra', 'december')
                            .replace('januára', 'januar')
                            .replace('februára', 'februar')
                            .replace('marca', 'marec')}</span>
                          <span>{expandedMonths[month] ? '▼' : '▶'}</span>
                        </div>
                        {expandedMonths[month] && (
                          <div className="operator-month-content">
                            <div className="operator-absence-list">
                              {monthAbsences.map((absence, index) => (
                                <div key={`absence-${month}-${index}`} className="operator-absence-item">
                                  <div className={`operator-absence-type ${absence.typ_absencie.toLowerCase()}`}>
                                    {renderAbsenceInfo([{
                                      dates: `(${format(new Date(absence.datum_od), 'dd.MM')}-${format(new Date(absence.datum_do), 'dd.MM')})`,
                                      type: absence.typ_absencie
                                    }])}
                                  </div>
                                  <div className={`operator-absence-dates ${absence.typ_absencie.toLowerCase()}`}>
                                    {formatDateRange(new Date(absence.datum_od), new Date(absence.datum_do))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showCountModal.show && showCountModal.date && (
        <div className="operator-modal-overlay" onClick={() => setShowCountModal({show: false, date: null, shift: ''})}>
          <div className="operator-modal" onClick={e => e.stopPropagation()}>
            <div className="operator-modal-header">
              <h2>Počet operátorov - {format(showCountModal.date, 'dd.MM.yyyy')}</h2>
              <button className="operator-modal-close" onClick={() => setShowCountModal({show: false, date: null, shift: ''})}>×</button>
            </div>
            <div className="operator-modal-content">
              <div className="operator-info-grid">
                <div className="operator-info-item">
                  <span className="operator-info-label">Kmeňový:</span>
                  <span className="operator-info-value">
                    {getOperatorsCountByType(getOperatorsForShift(showCountModal.shift, showCountModal.date), showCountModal.date).kmenovy}
                  </span>
                </div>
                <div className="operator-info-item">
                  <span className="operator-info-label">Agentúra:</span>
                  <span className="operator-info-value">
                    {getOperatorsCountByType(getOperatorsForShift(showCountModal.shift, showCountModal.date), showCountModal.date).agentura}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDeleteConfirm.show && (
        <ConfirmDialog
          isOpen={showDeleteConfirm.show}
          title="Potvrdenie vymazania"
          message="Naozaj chcete vymazať tohto zamestnanca?"
          confirmText="Áno, vymazať"
          cancelText="Zrušiť"
          onConfirm={handleConfirmDeleteOperator}
          onCancel={handleCancelDeleteOperator}
          type="danger"
        />
      )}
      {showDeputyModal && canManageDeputies && (
        <div className="deputy-modal-overlay" onClick={() => setShowDeputyModal(null)}>
          <div className="deputy-modal" onClick={e => e.stopPropagation()}>
            <h3>Pridať zástupcu</h3>
            <p>
              Pre: <strong>{showDeputyModal.position === 'VZ' ? 
                veduciZmeny.find(vz => vz.pozicia === `VZ${showDeputyModal.team}`)?.meno :
                zoradovaci.find(z => z.pozicia === `Zoradovac${showDeputyModal.team}`)?.meno}
              </strong>
              <br />
              Dňa: <strong>{format(showDeputyModal.date, 'dd.MM.yyyy')}</strong>
            </p>
            <input
              type="text"
              value={deputyName}
              onChange={(e) => setDeputyName(e.target.value)}
              placeholder="Meno zástupcu"
              autoFocus
            />
            <div className="deputy-modal-actions">
              <button onClick={handleAddDeputy}>Pridať</button>
              <button onClick={() => setShowDeputyModal(null)}>Zrušiť</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulePage; 
