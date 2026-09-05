'use client';
import { Button } from '@/components/nogma/Button';
import { IconButton } from '@/components/nogma/IconButton';
import { Card } from '@/components/nogma/Card';
import { Stat } from '@/components/nogma/Stat';
import { Badge } from '@/components/nogma/Badge';
import { Avatar } from '@/components/nogma/Avatar';
import { Input } from '@/components/nogma/Input';
import { Checkbox } from '@/components/nogma/Checkbox';
import { Switch } from '@/components/nogma/Switch';
import { Tabs } from '@/components/nogma/Tabs';
import { Plus, Search, Bell, Trash2 } from 'lucide-react';

export default function KitchenSink() {
  return (
    <main style={{ padding: 48, display: 'grid', gap: 32, maxWidth: 1000 }}>
      <section>
        <p className="eyebrow">Buttons</p>
        <div
          style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}
        >
          <Button variant="primary" leadingIcon={<Plus size={16} />}>
            Nova Obra
          </Button>
          <Button variant="solid">Solid</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" leadingIcon={<Trash2 size={16} />}>
            Danger
          </Button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <IconButton icon={<Search size={18} />} label="Search" />
          <IconButton icon={<Bell size={18} />} label="Alerts" />
        </div>
      </section>

      <section>
        <p className="eyebrow">Data display</p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            marginTop: 12,
          }}
        >
          <Stat
            label="Obras Ativas"
            value="12"
            delta="+3"
            direction="up"
            caption="este mês"
          />
          <Stat
            label="Total no mês"
            value="R$ 128k"
            delta="-2%"
            direction="down"
            caption="vs. anterior"
          />
          <Stat label="Documentos" value="87" caption="NFs + comprovantes" />
          <Stat label="Pendentes" value="4" caption="aguardando" />
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 16,
            alignItems: 'center',
          }}
        >
          <Badge>Ativo</Badge>
          <Badge variant="success">Confirmado</Badge>
          <Badge variant="warning">Pendente</Badge>
          <Badge variant="danger">Bloqueado</Badge>
          <Avatar name="Fernando Cavalcanti" />
          <Avatar name="Ana Silva" size="sm" />
        </div>
      </section>

      <section>
        <p className="eyebrow">Form</p>
        <Card>
          <div style={{ display: 'grid', gap: 12, padding: 16 }}>
            <Input label="E-mail" placeholder="voce@exemplo.com" />
            <Input label="Senha" type="password" />
            <Checkbox label="Manter conectada" defaultChecked />
            <Switch label="Notificações WhatsApp" defaultChecked />
          </div>
        </Card>
      </section>

      <section>
        <p className="eyebrow">Navigation</p>
        <Tabs
          items={[
            { value: 'geral', label: 'Geral' },
            { value: 'pagamentos', label: 'Pagamentos' },
            { value: 'docs', label: 'Documentos' },
          ]}
          defaultValue="geral"
        />
      </section>
    </main>
  );
}
