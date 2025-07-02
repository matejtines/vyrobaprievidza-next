import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfWeek, addDays, getWeek, parseISO } from 'date-fns';
import { sk } from 'date-fns/locale';
import './MechanicsPage.css';
import { supabase } from '../lib/supabase';
import { useDrag, useDrop } from 'react-dnd/dist/hooks';
import type { DragSourceMonitor, DropTargetMonitor } from 'react-dnd';
import { useUser } from '../context/UserContext';

function getISOWeek(date: Date) {
  return getWeek(date, { weekStartsOn: 1, locale: sk });
}

function getInputWeekValue(date: Date) {
  const isoWeek = getISOWeek(date);
  const year = date.getFullYear();
  return `${year}-W${String(isoWeek).padStart(2, '0')}`;
}

// Typy
type ShiftType = 'Ranná' | 'Poobedná' | 'Víkend';
type WeekendDay = 'sobota' | 'nedela' | null;

interface Absence {
  id: number;
  employee_id: number;
  typ_absencie: 'dovolenka' | '§' | 'LS' | 'pn';
  datum_od: string;
  datum_do: string;
}

interface Mechanic {
  id: number;
  name: string;
  shift: ShiftType;
  absences: Absence[];
  weekendDay?: WeekendDay;
}

const ITEM_TYPE = 'mechanic';

// Komponenty
const AbsenceBadge: React.FC<{ absence: Absence }> = React.memo(({ absence }) => {
  const formatDate = (dateStr: string) => format(new Date(dateStr), 'd.M.yyyy', { locale: sk });
  
  const { badgeClass, badgeText, tooltip } = useMemo(() => {
    let badgeClass = '';
    let badgeText = '';
    let absenceType = '';
    
    switch (absence.typ_absencie) {
      case 'dovolenka':
        badgeClass = 'absence-badge vacation';
        badgeText = 'DO';
        absenceType = 'Dovolenka';
        break;
      case '§':
        badgeClass = 'absence-badge sick';
        badgeText = '§';
        absenceType = 'Paragraf';
        break;
      case 'LS':
        badgeClass = 'absence-badge ls';
        badgeText = 'LS';
        absenceType = 'Lekár Sprievod';
        break;
      case 'pn':
        badgeClass = 'absence-badge sick';
        badgeText = 'PN';
        absenceType = 'PN';
        break;
      default:
        return { badgeClass: '', badgeText: '', tooltip: '' };
    }
    
    const tooltip = `${absenceType}\n${formatDate(absence.datum_od)} - ${formatDate(absence.datum_do)}`;
    return { badgeClass, badgeText, tooltip };
  }, [absence]);

  if (!badgeClass) return null;

  return (
    <span className={badgeClass} title={tooltip}>
      {badgeText}
    </span>
  );
});

// Pridáme funkciu na výpočet dátumu víkendu
const getWeekendDates = (week: number, year: number) => {
  // Vypočítame dátum prvého dňa týždňa (pondelok)
  const firstDayOfYear = new Date(year, 0, 1);
  const firstMonday = new Date(firstDayOfYear);
  firstMonday.setDate(firstDayOfYear.getDate() + (8 - firstDayOfYear.getDay()) % 7);
  
  // Pridáme týždne k dátumu
  const targetMonday = new Date(firstMonday);
  targetMonday.setDate(firstMonday.getDate() + (week - 1) * 7);
  
  // Vypočítame sobotu a nedeľu
  const saturday = new Date(targetMonday);
  saturday.setDate(targetMonday.getDate() + 5);
  
  const sunday = new Date(targetMonday);
  sunday.setDate(targetMonday.getDate() + 6);
  
  return {
    sobota: saturday.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    nedela: sunday.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' })
  };
};

const Mechanic: React.FC<{
  mechanic: Mechanic;
  onDrop: (id: number, newShift: ShiftType, weekendDay?: WeekendDay) => void;
}> = React.memo(({ mechanic, onDrop }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ITEM_TYPE,
    item: mechanic,
    collect: (monitor) => ({ 
      isDragging: monitor.isDragging() 
    }),
  }), [mechanic]);

  const weekendDates = getWeekendDates(getISOWeek(new Date()), new Date().getFullYear());

  return (
    <div
      ref={drag}
      className={`mechanic ${mechanic.absences.length > 0 ? 'absence' : ''}`}
      draggable={mechanic.absences.length === 0}
      onDragStart={(e) => {
        e.dataTransfer.setData('text', JSON.stringify({ id: mechanic.id, shift: mechanic.shift, weekendDay: mechanic.weekendDay }));
      }}
      data-id={mechanic.id}
    >
      <div className="operator-name-container">
        <span className="operator-name">{mechanic.name}</span>
        {mechanic.shift === 'Víkend' && mechanic.weekendDay && (
          <span 
            className={`weekend-day-badge ${mechanic.weekendDay}`}
            title={`${mechanic.weekendDay === 'sobota' ? 'Sobota' : 'Nedeľa'}: ${weekendDates[mechanic.weekendDay]}`}
          >
            {mechanic.weekendDay === 'sobota' ? 'S' : 'N'}
          </span>
        )}
      </div>
      <div className="absence-badges-container">
        {mechanic.absences.map(absence => (
          <AbsenceBadge key={absence.id} absence={absence} />
        ))}
      </div>
    </div>
  );
});

const MechanicsColumn: React.FC<{
  shift: ShiftType;
  mechanics: Mechanic[];
  onDrop: (id: number, newShift: ShiftType, weekendDay?: WeekendDay) => void;
}> = React.memo(({ shift, mechanics, onDrop }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ITEM_TYPE,
    drop: (item: Mechanic) => onDrop(item.id, shift),
    collect: (monitor) => ({ 
      isOver: monitor.isOver() 
    }),
  }), [shift, onDrop]);

  return (
    <div
      ref={drop}
      className={`mechanics-column${isOver ? ' drop-hover' : ''}`}
      style={{ background: isOver ? 'rgba(0, 0, 0, 0.07)' : 'transparent' }}
    >
      <div className="mechanics-team-header">{shift}</div>
      <div className="mechanics-operators-list">
        {mechanics.length === 0 ? (
          <span className="mechanics-empty">Žiadny zamestnanec</span>
        ) : (
          mechanics.map(m => (
            <Mechanic key={m.id} mechanic={m} onDrop={onDrop} />
          ))
        )}
      </div>
    </div>
  );
});

const MechanicsPage: React.FC = () => {
  const { user } = useUser();
  // Stav
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [weekNumber, setWeekNumber] = useState<number>(getISOWeek(new Date()));
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [showWeekendModal, setShowWeekendModal] = useState(false);
  const [selectedMechanic, setSelectedMechanic] = useState<Mechanic | null>(null);

  const canManageMechanics = user?.role === 'admin' || user?.role === 'managermechanik' || user?.role === 'managervyroby';

  // Memoizované hodnoty
  const weekRange = useMemo(() => {
    const monday = startOfWeek(selectedDate, { weekStartsOn: 1, locale: sk });
    const sunday = addDays(monday, 6);
    return { monday, sunday };
  }, [selectedDate]);

  // Načítanie dát
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Paralelné načítanie všetkých potrebných dát
      const [
        { data: mechanicsData, error: mechanicsError },
        { data: assignmentsData, error: assignmentsError },
        { data: absencesData, error: absencesError }
      ] = await Promise.all([
        supabase
          .from('zamestnanci')
          .select('id, meno, zmena')
          .eq('zmena', 'mechanik')
          .order('meno'),
        supabase
          .from('zadelenie_mechanikov')
          .select('mechanik_id, zmena')
          .eq('tyzden', weekNumber)
          .eq('rok', year),
        supabase
          .from('absencie')
          .select('*')
          .gte('datum_od', weekRange.monday.toISOString())
          .lte('datum_do', weekRange.sunday.toISOString())
      ]);

      if (mechanicsError) throw mechanicsError;
      if (assignmentsError) throw assignmentsError;
      if (absencesError) throw absencesError;

      // Spracovanie dát
      const processedMechanics = (mechanicsData || []).map((emp: any) => {
        const assignment = (assignmentsData || []).find((a: any) => a.mechanik_id === emp.id);
        const mechanicAbsences = (absencesData || []).filter((a: Absence) => a.employee_id === emp.id);

        return {
          id: emp.id,
          name: emp.meno,
          shift: assignment?.zmena || 'Ranná',
          absences: mechanicAbsences
        };
      });

      setMechanics(processedMechanics);
    } catch (err) {
      console.error('Chyba pri načítaní dát:', err);
    } finally {
      setIsLoading(false);
    }
  }, [weekNumber, year, weekRange]);

  // Efekty
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(weekRange.monday, i));
    }
    setWeekDates(dates);
  }, [weekRange]);

  // Handlery
  const handleDateChange = useCallback((date: Date | null) => {
    if (!date) return;
    setSelectedDate(date);
    setWeekNumber(getISOWeek(date));
    setYear(date.getFullYear());
  }, []);

  const handleDrop = useCallback(async (mechanicId: number, newShift: ShiftType, weekendDay?: WeekendDay) => {
    if (!canManageMechanics) {
      alert('Nemáte oprávnenie na presun mechanika.');
      return;
    }

    try {
      if (newShift === 'Víkend' && !weekendDay) {
        const mechanic = mechanics.find(m => m.id === mechanicId);
        if (mechanic) {
          setSelectedMechanic(mechanic);
          setShowWeekendModal(true);
          return;
        }
      }

      const { error } = await supabase
        .from('zadelenie_mechanikov')
        .upsert(
          {
            mechanik_id: mechanicId,
            zmena: newShift,
            tyzden: weekNumber,
            rok: year,
            weekend_day: weekendDay
          },
          {
            onConflict: 'mechanik_id,tyzden,rok',
            ignoreDuplicates: false
          }
        );

      if (error) {
        console.error('Detail chyby:', error);
        throw error;
      }

      setMechanics(prev => prev.map(m => 
        m.id === mechanicId ? { ...m, shift: newShift, weekendDay } : m
      ));
    } catch (err) {
      console.error('Chyba pri aktualizácii zadelenia:', err);
      setMechanics(prev => prev.map(m => 
        m.id === mechanicId ? { ...m, shift: m.shift } : m
      ));
    }
  }, [weekNumber, year, mechanics, canManageMechanics]);

  const handleWeekendDaySelect = useCallback((day: WeekendDay) => {
    if (!canManageMechanics) {
      alert('Nemáte oprávnenie na výber víkendového dňa.');
      return;
    }

    if (selectedMechanic) {
      handleDrop(selectedMechanic.id, 'Víkend', day);
    }
    setShowWeekendModal(false);
    setSelectedMechanic(null);
  }, [selectedMechanic, handleDrop, canManageMechanics]);

  // Pomocné funkcie
  const getMechanicsForShift = useCallback((shift: ShiftType) => {
    return mechanics.filter(m => m.shift === shift);
  }, [mechanics]);

  // Render
  if (isLoading) {
    return <div className="loading">Načítavam...</div>;
  }

  return (
    <div className="mechanics-page">
      <div className="mechanics-header">
        <h1>Zadelenie mechanikov</h1>
        <input
          type="week"
          value={getInputWeekValue(selectedDate)}
          onChange={(e) => {
            const [year, week] = e.target.value.split('-W');
            const date = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
            handleDateChange(date);
          }}
        />
      </div>

      <div className="mechanics-grid">
        <MechanicsColumn
          shift="Ranná"
          mechanics={getMechanicsForShift('Ranná')}
          onDrop={canManageMechanics ? handleDrop : () => {}}
        />
        <MechanicsColumn
          shift="Poobedná"
          mechanics={getMechanicsForShift('Poobedná')}
          onDrop={canManageMechanics ? handleDrop : () => {}}
        />
        <MechanicsColumn
          shift="Víkend"
          mechanics={getMechanicsForShift('Víkend')}
          onDrop={canManageMechanics ? handleDrop : () => {}}
        />
      </div>

      {showWeekendModal && selectedMechanic && canManageMechanics && (
        <div className="modal-overlay">
          <div className="weekend-modal">
            <h3>Vyberte deň víkendu pre {selectedMechanic.name}</h3>
            <div className="weekend-buttons">
              <button 
                className="weekend-button sobota"
                onClick={() => handleWeekendDaySelect('sobota')}
              >
                Sobota
              </button>
              <button 
                className="weekend-button nedela"
                onClick={() => handleWeekendDaySelect('nedela')}
              >
                Nedeľa
              </button>
              <button 
                className="weekend-button cancel"
                onClick={() => {
                  setShowWeekendModal(false);
                  setSelectedMechanic(null);
                }}
              >
                Zrušiť
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MechanicsPage; 