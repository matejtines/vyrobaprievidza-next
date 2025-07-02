import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfWeek, addDays, getWeek, parseISO } from 'date-fns';
import { sk } from 'date-fns/locale';
import './QualityPage.css';
import { supabase } from '../lib/supabase';
import { useDrag, useDrop } from 'react-dnd/dist/hooks';
import type { DragSourceMonitor, DropTargetMonitor } from 'react-dnd';
import { useUser } from '../context/UserContext';

// Pomocné funkcie
function getISOWeek(date: Date) {
  return getWeek(date, { weekStartsOn: 1, locale: sk });
}

function getInputWeekValue(date: Date) {
  const year = date.getFullYear();
  const isoWeek = getISOWeek(date);
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

interface QualityEmployee {
  id: number;
  name: string;
  shift: ShiftType;
  weekendDay?: WeekendDay;
  absences: Absence[];
}

const ITEM_TYPE = 'quality_employee';

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

const QualityOperator: React.FC<{
  employee: QualityEmployee;
  onDrop: (id: number, newShift: ShiftType, weekendDay?: WeekendDay) => void;
}> = React.memo(({ employee, onDrop }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ITEM_TYPE,
    item: employee,
    collect: (monitor) => ({ 
      isDragging: monitor.isDragging() 
    }),
  }), [employee]);

  const weekendDates = getWeekendDates(getISOWeek(new Date()), new Date().getFullYear());

  return (
    <div
      ref={drag}
      className={`quality-operator${isDragging ? ' dragging' : ''}`}
      style={{ opacity: isDragging ? 0.5 : 1, cursor: 'move' }}
    >
      <div className="operator-name-container">
        <span className="operator-name">{employee.name}</span>
        {employee.shift === 'Víkend' && employee.weekendDay && (
          <span 
            className={`weekend-day-badge ${employee.weekendDay}`}
            title={`${employee.weekendDay === 'sobota' ? 'Sobota' : 'Nedeľa'}: ${weekendDates[employee.weekendDay]}`}
          >
            {employee.weekendDay === 'sobota' ? 'S' : 'N'}
          </span>
        )}
      </div>
      <div className="absence-badges-container">
        {employee.absences.map(absence => (
          <AbsenceBadge key={absence.id} absence={absence} />
        ))}
      </div>
    </div>
  );
});

const QualityColumn: React.FC<{
  shift: ShiftType;
  employees: QualityEmployee[];
  onDrop: (id: number, newShift: ShiftType, weekendDay?: WeekendDay) => void;
}> = React.memo(({ shift, employees, onDrop }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ITEM_TYPE,
    drop: (item: QualityEmployee) => onDrop(item.id, shift),
    collect: (monitor) => ({ 
      isOver: monitor.isOver() 
    }),
  }), [shift, onDrop]);

  return (
    <div
      ref={drop}
      className={`quality-column${isOver ? ' drop-hover' : ''}`}
      style={{ background: isOver ? 'rgba(0, 0, 0, 0.07)' : 'transparent' }}
    >
      <div className="quality-team-header">{shift}</div>
      <div className="quality-operators-list">
        {employees.length === 0 ? (
          <span className="quality-empty">Žiadny zamestnanec</span>
        ) : (
          employees.map(e => (
            <QualityOperator key={e.id} employee={e} onDrop={onDrop} />
          ))
        )}
      </div>
    </div>
  );
});

const QualityPage: React.FC = () => {
  const { user } = useUser();
  // Stav
  const [employees, setEmployees] = useState<QualityEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [weekNumber, setWeekNumber] = useState<number>(getISOWeek(new Date()));
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [showWeekendModal, setShowWeekendModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<QualityEmployee | null>(null);

  const canManageQuality = user?.role === 'admin' || user?.role === 'managerkvalita';

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
        { data: employeesData, error: employeesError },
        { data: assignmentsData, error: assignmentsError },
        { data: absencesData, error: absencesError }
      ] = await Promise.all([
        supabase
          .from('zamestnanci')
          .select('id, meno, zmena')
          .eq('zmena', 'kvalita')
          .order('meno'),
        supabase
          .from('zadelenie_kvalita')
          .select('zamestnanec_id, zmena, weekend_day')
          .eq('tyzden', weekNumber)
          .eq('rok', year),
        supabase
          .from('absencie')
          .select('*')
          .gte('datum_od', weekRange.monday.toISOString())
          .lte('datum_do', weekRange.sunday.toISOString())
      ]);

      if (employeesError) throw employeesError;
      if (assignmentsError) throw assignmentsError;
      if (absencesError) throw absencesError;

      // Spracovanie dát
      const processedEmployees = (employeesData || []).map((emp: any) => {
        const assignment = (assignmentsData || []).find((a: any) => a.zamestnanec_id === emp.id);
        const employeeAbsences = (absencesData || []).filter((a: Absence) => a.employee_id === emp.id);

        return {
          id: emp.id,
          name: emp.meno,
          shift: assignment?.zmena || 'Ranná',
          weekendDay: assignment?.weekend_day || null,
          absences: employeeAbsences
        };
      });

      setEmployees(processedEmployees);
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

  const handleDrop = useCallback(async (employeeId: number, newShift: ShiftType, weekendDay?: WeekendDay) => {
    if (!canManageQuality) {
      alert('Nemáte oprávnenie na presun zamestnanca.');
      return;
    }

    try {
      if (newShift === 'Víkend' && !weekendDay) {
        const employee = employees.find(e => e.id === employeeId);
        if (employee) {
          setSelectedEmployee(employee);
          setShowWeekendModal(true);
          return;
        }
      }

      const { error } = await supabase
        .from('zadelenie_kvalita')
        .upsert(
          {
            zamestnanec_id: employeeId,
            zmena: newShift,
            tyzden: weekNumber,
            rok: year,
            weekend_day: weekendDay
          },
          {
            onConflict: 'zamestnanec_id,tyzden,rok',
            ignoreDuplicates: false
          }
        );

      if (error) {
        console.error('Detail chyby:', error);
        throw error;
      }

      setEmployees(prev => prev.map(e => 
        e.id === employeeId ? { ...e, shift: newShift, weekendDay } : e
      ));
    } catch (err) {
      console.error('Chyba pri aktualizácii zadelenia:', err);
      setEmployees(prev => prev.map(e => 
        e.id === employeeId ? { ...e, shift: e.shift } : e
      ));
    }
  }, [weekNumber, year, employees, canManageQuality]);

  const handleWeekendDaySelect = useCallback((day: WeekendDay) => {
    if (!canManageQuality) {
      alert('Nemáte oprávnenie na výber víkendového dňa.');
      return;
    }

    if (selectedEmployee) {
      handleDrop(selectedEmployee.id, 'Víkend', day);
    }
    setShowWeekendModal(false);
    setSelectedEmployee(null);
  }, [selectedEmployee, handleDrop, canManageQuality]);

  // Pomocné funkcie
  const getEmployeesForShift = useCallback((shift: ShiftType) => {
    return employees.filter(e => e.shift === shift);
  }, [employees]);

  // Render
  if (isLoading) {
    return <div className="loading">Načítavam...</div>;
  }

  return (
    <div className="quality-page">
      <div className="quality-header">
        <h1>Zadelenie kvality</h1>
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

      <div className="quality-grid">
        <QualityColumn
          shift="Ranná"
          employees={getEmployeesForShift('Ranná')}
          onDrop={canManageQuality ? handleDrop : () => {}}
        />
        <QualityColumn
          shift="Poobedná"
          employees={getEmployeesForShift('Poobedná')}
          onDrop={canManageQuality ? handleDrop : () => {}}
        />
        <QualityColumn
          shift="Víkend"
          employees={getEmployeesForShift('Víkend')}
          onDrop={canManageQuality ? handleDrop : () => {}}
        />
      </div>

      {showWeekendModal && selectedEmployee && canManageQuality && (
        <div className="modal-overlay">
          <div className="weekend-modal">
            <h3>Vyberte deň víkendu pre {selectedEmployee.name}</h3>
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
                  setSelectedEmployee(null);
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

export default QualityPage; 