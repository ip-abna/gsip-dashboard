import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from './FilterBar';
import { FilterProvider } from '../contexts/FilterContext';
import { DataProvider } from '../contexts/DataContext';

// Sem isto o DataProvider chamaria a API real do Google a cada teste
vi.mock('../services', () => ({
    createGoogleSheetsService: () => ({
        fetchData: () => Promise.resolve({ rows: [], locale: 'pt_BR' })
    })
}));

// Função auxiliar para renderizar FilterBar com providers necessários
function renderFilterBar() {
    return render(
        <DataProvider>
            <FilterProvider>
                <FilterBar />
            </FilterProvider>
        </DataProvider>
    );
}

describe('FilterBar', () => {
    it('deve renderizar seletor de escopo geográfico', () => {
        renderFilterBar();
        expect(screen.getByLabelText('Escopo Geográfico')).toBeInTheDocument();
    });

    it('deve exibir todas as opções de escopo geográfico', () => {
        renderFilterBar();
        const select = screen.getByLabelText('Escopo Geográfico') as HTMLSelectElement;

        expect(select).toBeInTheDocument();
        expect(screen.getByText('Brasil Todo')).toBeInTheDocument();
        expect(screen.getByText('CSA')).toBeInTheDocument();
        expect(screen.getByText('Região (CSR)')).toBeInTheDocument();
        expect(screen.getByText('Estado')).toBeInTheDocument();
        expect(screen.getByText('Cidade')).toBeInTheDocument();
    });

    it('deve renderizar inputs de intervalo de datas', () => {
        renderFilterBar();
        expect(screen.getByLabelText('Data Inicial')).toBeInTheDocument();
        expect(screen.getByLabelText('Data Final')).toBeInTheDocument();
    });

    it('deve renderizar botão de limpar filtros', () => {
        renderFilterBar();
        expect(screen.getByText('Limpar Filtros')).toBeInTheDocument();
    });

    it('deve mostrar dropdown de CSA quando escopo CSA é selecionado', () => {
        renderFilterBar();
        const scopeSelect = screen.getByLabelText('Escopo Geográfico') as HTMLSelectElement;

        fireEvent.change(scopeSelect, { target: { value: 'csa' } });

        expect(screen.getByLabelText('Selecione o CSA')).toBeInTheDocument();
    });

    it('deve mostrar dropdown de Região quando escopo região é selecionado', () => {
        renderFilterBar();
        const scopeSelect = screen.getByLabelText('Escopo Geográfico') as HTMLSelectElement;

        fireEvent.change(scopeSelect, { target: { value: 'region' } });

        expect(screen.getByLabelText('Selecione a Região (CSR)')).toBeInTheDocument();
    });

    it('deve mostrar dropdown de Estado quando escopo estado é selecionado', () => {
        renderFilterBar();
        const scopeSelect = screen.getByLabelText('Escopo Geográfico') as HTMLSelectElement;

        fireEvent.change(scopeSelect, { target: { value: 'state' } });

        expect(screen.getByLabelText('Selecione o Estado')).toBeInTheDocument();
    });

    it('deve mostrar dropdowns de Estado e Cidade quando escopo cidade é selecionado', () => {
        renderFilterBar();
        const scopeSelect = screen.getByLabelText('Escopo Geográfico') as HTMLSelectElement;

        fireEvent.change(scopeSelect, { target: { value: 'city' } });

        expect(screen.getByLabelText('Selecione o Estado')).toBeInTheDocument();
        // Dropdown de cidade aparece após estado ser selecionado
    });

    it('deve ter labels em português', () => {
        renderFilterBar();

        // Verifica labels em português
        expect(screen.getByText('Escopo Geográfico')).toBeInTheDocument();
        expect(screen.getByText('Data Inicial')).toBeInTheDocument();
        expect(screen.getByText('Data Final')).toBeInTheDocument();
        expect(screen.getByText('Limpar Filtros')).toBeInTheDocument();
    });
});
