import type { Meta, StoryObj } from '@storybook/react-vite';
import { EnergySolutionButtons } from '../components/FigmaBlokk/components/EnergySolutionButtons';
import '../punkt.scss';
import '../index.css';

const mockBuildingData = {
  adresse: 'Testveien 1',
  postnummer: '0123',
  poststed: 'Oslo',
  kommunenummer: '0301',
  kommunenavn: 'Oslo',
  gardsnummer: '1',
  bruksnummer: '1',
  bygningsnummer: '123456789',
  bruksarealM2: 120,
  byggeaar: 1985,
  bygningstypeKode: '111',
  bygningstypeNavn: 'Enebolig',
  energiKarakter: 'E',
  csvData: {
    bruksareal_totalt: '120',
    bygningstypekode: '111',
  },
};

const meta: Meta<typeof EnergySolutionButtons> = {
  title: 'Komponenter/EnergySolutionButtons',
  component: EnergySolutionButtons,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#034B45' },
        { name: 'light', value: '#F8F0DD' },
      ],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showHeader: {
      control: 'boolean',
      description: 'Vis header over tiltakslisten',
    },
    isExpanded: {
      control: 'boolean',
      description: 'Om komponenten er ekspandert',
    },
    yearlyConsumption: {
      control: 'text',
      description: 'Årlig energiforbruk i kWh',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    showHeader: true,
    isExpanded: true,
    onExpand: (expanded) => console.log('Expanded:', expanded),
    onSelectSolution: (solution) => console.log('Selected:', solution),
    buildingData: mockBuildingData,
    yearlyConsumption: '25000',
  },
};

export const Collapsed: Story = {
  args: {
    ...Default.args,
    isExpanded: false,
  },
};

export const WithoutHeader: Story = {
  args: {
    ...Default.args,
    showHeader: false,
  },
};

export const Blokk: Story = {
  args: {
    ...Default.args,
    buildingData: {
      ...mockBuildingData,
      bygningstypeKode: '141',
      bygningstypeNavn: 'Boligblokk',
    },
  },
};

export const GammeltHus: Story = {
  args: {
    ...Default.args,
    buildingData: {
      ...mockBuildingData,
      byggeaar: 1920,
      energiKarakter: 'G',
    },
    yearlyConsumption: '35000',
  },
};

export const NyttHus: Story = {
  args: {
    ...Default.args,
    buildingData: {
      ...mockBuildingData,
      byggeaar: 2020,
      energiKarakter: 'B',
    },
    yearlyConsumption: '12000',
  },
};
