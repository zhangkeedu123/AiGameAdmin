import React, { useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Input, Modal, Spin, Col, ConfigProvider, Descriptions, Flex, Image, Popconfirm, Result, Row, Segmented, Space, Statistic, Tag, Typography } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { DashboardOutlined, PictureOutlined, TeamOutlined, TrophyOutlined, LogoutOutlined, PlusOutlined, GiftOutlined } from '@ant-design/icons';
import { LoginForm, ModalForm, PageContainer, ProCard, ProFormDigit, ProFormSelect, ProFormSwitch, ProFormText, ProFormTextArea, ProLayout, ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Upload } from 'antd';

const categories = {
  normal: { label: '普通', color: 'green' },
  hard: { label: '困难', color: 'blue' },
  extreme: { label: '极难', color: 'volcano' },
  daily: { label: '每日一瓷', color: 'gold' },
};
const categoryOptions = Object.entries(categories).map(([value, item]) => ({ value, label: item.label }));
const shipment = {
  pending: { label: '待处理', color: 'gold' },
  processing: { label: '备货中', color: 'blue' },
  shipped: { label: '已发货', color: 'cyan' },
  delivered: { label: '已签收', color: 'green' },
};
const shipmentOptions = Object.entries(shipment).map(([value, item]) => ({ value, label: item.label }));
type Level = { id: string; name: string; story?: string; category: keyof typeof categories; status: string;
  pieces: number; level_number?: number; atlas_version: number; rotate_count: number; decoy_count: number;
  has_original: boolean; created_at: string };
type Preview = { poster: [number, number, number, number]; decoy_count: number; cutout: boolean;
  shards: { box: number[]; poly: number[]; sprite: [number, number, number, number] }[] };
type Claim = { id: string; user_id: string; nickname?: string; source?: keyof typeof sources; recipient: string;
  phone: string; address: string; status: keyof typeof shipment; carrier?: string; tracking_number?: string;
  created_at: string; updated_at: string; reward_month?: string };
type Player = { id: string; nickname: string; source?: string; login_count: number; last_login_at?: string; active: boolean };
type Rank = { rank: number; nickname?: string; source?: keyof typeof sources;
  category: keyof typeof categories; level_number: number; elapsed_ms: number };
const duration = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
};
const nav = [
  { path: '/', name: '总览', icon: <DashboardOutlined /> },
  { path: '/levels', name: '瓷器关卡', icon: <PictureOutlined /> },
  { path: '/players', name: '玩家管理', icon: <TeamOutlined /> },
  { path: '/ranking', name: '排行榜', icon: <TrophyOutlined /> },
  { path: '/redemptions', name: '瓷器兑换', icon: <GiftOutlined /> },
];
const sources = { wechat: '微信', douyin: '抖音' };
const platforms = Object.entries(sources).map(([value, label]) => ({ value, label }));
const date = (value?: string) => value ? new Date(value).toLocaleString('zh-CN') : '—';
const form = (values: Record<string, any>) => {
  const body = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null) body.append(key, value instanceof File ? value : String(value));
  });
  return body;
};
let csrf = '';
async function api(path: string, method = 'GET', values?: Record<string, any>) {
  const response = await fetch('/admin' + path, { method, credentials: 'same-origin',
    headers: method === 'GET' ? {} : { 'X-CSRF-Token': csrf }, body: values ? form(values) : undefined });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== '/login') window.dispatchEvent(new Event('admin-session-expired'));
    throw new Error(typeof data.detail === 'string' ? data.detail :
      Array.isArray(data.detail) ? data.detail.map((item: any) => item.msg).join('；') : '请求失败');
  }
  return data;
}

function Dashboard({ go }: { go: (path: string) => void }) {
  const [info, setInfo] = useState<Record<string, number>>();
  const { message } = App.useApp();
  useEffect(() => { api('/overview').then(setInfo).catch(error => message.error(error.message)); }, []);
  return <PageContainer title="运营总览" extra={<Button type="primary" icon={<PictureOutlined />} onClick={() => go('/levels')}>管理关卡</Button>}>
    <Row gutter={[16, 16]}>{[
      ['published', '已发布关卡', <PictureOutlined />], ['drafts', '待发布草稿', <DashboardOutlined />],
      ['players', '登记玩家', <TeamOutlined />], ['completions', '累计通关', <TrophyOutlined />],
    ].map(([key, label, icon]) => <Col key={String(key)} xs={12} lg={6}><ProCard bordered loading={!info}>
      <Statistic title={label} prefix={icon} value={info?.[String(key)] ?? 0} />
    </ProCard></Col>)}</Row>
  </PageContainer>;
}

function atlasUrl(level: Level) {
  return '/admin/levels/' + level.id + '/atlas.png?v=' + level.atlas_version;
}

function isStraightCut(data: Preview) {
  const real = data.shards.slice(0, data.shards.length - (data.decoy_count || 0));
  return real.length > 0 && real.every(({ poly }) => poly.length === 8 &&
    [0, 2, 4, 6].every(i => {
      const next = (i + 2) % poly.length;
      return poly[i] === poly[next] || poly[i + 1] === poly[next + 1];
    }));
}

function FragmentPreview({ level, close, recut }: { level: Level; close: () => void; recut: () => Promise<void> }) {
  const [data, setData] = useState<Preview>();
  const [error, setError] = useState('');
  const [image, setImage] = useState<HTMLImageElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    const bitmap = new window.Image();
    bitmap.onload = () => { if (active) setImage(bitmap); };
    bitmap.onerror = () => { if (active) setError('图集加载失败'); };
    bitmap.src = atlasUrl(level);
    api('/levels/' + level.id + '/preview?v=' + level.atlas_version).then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [level]);

  const straightCut = data && isStraightCut(data);
  const columns = 5;
  const height = 220 + Math.ceil((data?.shards.length || 0) / columns) * 86;
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !data || !image) return;
    ctx.clearRect(0, 0, 490, height);
    ctx.drawImage(image, ...data.poster, 165, 12, 160, 180);
    data.shards.forEach((piece, index) => {
      const [left, top] = piece.box;
      const [sx, sy, w, h] = piece.sprite;
      const x = (index % columns) * 98 + 49, y = 220 + Math.floor(index / columns) * 86;
      const scale = Math.min(82 / w, 65 / h);
      ctx.save();
      ctx.translate(x - w * scale / 2, y);
      ctx.scale(scale, scale);
      if (data.cutout) {
        ctx.beginPath();
        ctx.moveTo(piece.poly[0] - left, piece.poly[1] - top);
        for (let i = 2; i < piece.poly.length; i += 2) ctx.lineTo(piece.poly[i] - left, piece.poly[i + 1] - top);
        ctx.closePath();
        ctx.clip();
      }
      ctx.drawImage(image, sx, sy, w, h, 0, 0, w, h);
      ctx.restore();
      ctx.fillStyle = index >= data.shards.length - data.decoy_count ? '#aa4f30' : '#416456';
      ctx.textAlign = 'center';
      ctx.font = '11px sans-serif';
      ctx.fillText(index >= data.shards.length - data.decoy_count ? '干扰 ' + (index + 1) : String(index + 1), x, y + 78);
    });
  }, [data, image, height]);

  return <Modal open title={level.name + ' · 碎片预览'} width={600} onCancel={close} footer={null}>
    {error ? <Alert type="error" message={error} /> : <Spin spinning={!data || !image}>
      <Flex gap={6} wrap="wrap">
        <Tag color="green">拼合 {level.pieces} 片</Tag><Tag color="blue">旋转 {level.rotate_count} 片</Tag>
        <Tag color="volcano">干扰 {level.decoy_count} 片</Tag>{level.has_original && <Tag>原图已保留</Tag>}
        {data?.cutout && !straightCut && <Tag color="cyan">随机棱角</Tag>}
      </Flex>
      {straightCut && <Alert type="warning" showIcon message="这关使用旧版直切碎片" style={{ marginTop: 12 }}
        action={<Popconfirm title="重新切成随机棱角碎片？"
          description="沿用当前片数与难度，保留之前的图集版本。" onConfirm={recut}>
          <Button size="small" type="primary">重切为棱角</Button>
        </Popconfirm>} />}
      <div style={{ maxHeight: '65vh', overflowY: 'auto', background: '#f0f4ee', borderRadius: 10, marginTop: 12 }}>
        <canvas ref={canvas} width={490} height={height} style={{ display: 'block', width: '100%' }} aria-label="完整瓷器和所有碎片" />
      </div>
    </Spin>}
  </Modal>;
}

function LevelNumber() {
  return <ProFormDigit name="level_number" label="第几关" min={1} max={1000000} fieldProps={{ precision: 0 }}
    extra="同分类编号不能重复，玩家按数字从小到大闯关。留空时上架自动编号。" />;
}

function FragmentFields() {
  return <Row gutter={12}>
    <Col span={8}><ProFormDigit name="pieces" label="拼合片数" min={3} max={64} fieldProps={{ precision: 0 }} rules={[{ required: true }]} /></Col>
    <Col span={8}><ProFormDigit name="rotate_count" label="旋转片数" min={0} max={64} fieldProps={{ precision: 0 }} rules={[{ required: true }]} /></Col>
    <Col span={8}><ProFormDigit name="decoy_count" label="干扰片数" min={0} max={16} fieldProps={{ precision: 0 }} rules={[{ required: true }]} /></Col>
  </Row>;
}

function Levels() {
  const { message } = App.useApp();
  const action = useRef<ActionType>();
  const [file, setFile] = useState<File>();
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<Level>();
  const [preview, setPreview] = useState<Level>();
  const [regenerate, setRegenerate] = useState(false);
  const [replacement, setReplacement] = useState<File>();
  const showSavedPreview = (id: string) => {
    api('/levels').then((rows: Level[]) => setPreview(rows.find(level => level.id === id)))
      .catch(() => message.warning('关卡已保存，可稍后从列表打开碎片预览。'));
  };
  const recut = async (row: Level) => {
    try {
      const { atlas_version } = await api('/levels/' + row.id, 'PATCH', {
        name: row.name, story: row.story, category: row.category, level_number: row.level_number,
        atlas_version: row.atlas_version, pieces: row.pieces,
        rotate_count: row.rotate_count, decoy_count: row.decoy_count,
      });
      setPreview(current => current?.id === row.id && current.atlas_version === row.atlas_version ?
        { ...row, atlas_version } : current);
      action.current?.reload();
      message.success('已重新切成随机棱角碎片');
    } catch (error: any) { message.error(error.message); }
  };
  const mutate = async (row: Level, publish: boolean) => {
    try {
      await api('/levels/' + row.id + (publish ? '/publish' : ''), publish ? 'POST' : 'DELETE');
      message.success(publish ? '关卡已发布' : '已处理');
      action.current?.reload();
    } catch (error: any) { message.error(error.message); }
  };
  const columns: ProColumns<Level>[] = [
    { title: '瓷器', dataIndex: 'name', render: (_, item) => <Space><Image width={45} height={48}
      style={{ objectFit: 'contain' }} preview={false} src={atlasUrl(item)} alt={item.name} /><Typography.Text strong>{item.name}</Typography.Text></Space> },
    { title: '状态', dataIndex: 'status', render: (_, item) => <Tag color={item.status === 'published' ? 'green' : 'default'}>{{ published: '已上架', draft: '草稿', archived: '已下架' }[item.status]}</Tag> },
    { title: '分类', dataIndex: 'category', render: (_, row) => <Tag color={categories[row.category].color}>{categories[row.category].label}</Tag> },
    { title: '关卡', dataIndex: 'level_number', render: (_, row) => row.level_number ? '第 ' + row.level_number + ' 关' : '待编号' },
    { title: '拼合 / 旋转 / 干扰', render: (_, row) => [row.pieces, row.rotate_count, row.decoy_count].join(' / ') },
    { title: '创建时间', dataIndex: 'created_at', render: (_, row) => date(row.created_at) },
    { title: '操作', valueType: 'option', render: (_, row) => <Space>
      <Button type="link" onClick={() => setPreview(row)}>碎片预览</Button>
      <Button type="link" onClick={() => { setRegenerate(false); setReplacement(undefined); setEditing(row); }}>修改</Button>
      {row.status !== 'published' && <Popconfirm
        title={row.category === 'daily' ? '上架后进入每日一瓷轮换' : '上架后将在相应小游戏模式中显示'}
        onConfirm={() => mutate(row, true)}>
        <Button type="link">{row.status === 'archived' ? '重新上架' : '上架'}</Button>
      </Popconfirm>}
      {row.status !== 'archived' && <Popconfirm title={row.status === 'draft' ? '删除草稿及贴图？' : '下架关卡，保留玩家历史？'} onConfirm={() => mutate(row, false)}><Button type="link" danger>{row.status === 'draft' ? '删除' : '下架'}</Button></Popconfirm>}
    </Space> },
  ];
  return <PageContainer title="瓷器关卡"><ProTable<Level> rowKey="id" columns={columns} actionRef={action}
    search={false} params={{ status, category }} request={async () => {
      const rows: Level[] = await api('/levels');
      return { data: rows.filter(row => (status === 'all' || row.status === status) && (!category || row.category === category)), success: true };
    }} onRequestError={error => message.error(error.message)}
    toolbar={{ filter: <Space wrap>
      <Segmented value={status} onChange={value => setStatus(String(value))} options={[
        { label: '全部', value: 'all' }, { label: '草稿', value: 'draft' },
        { label: '已上架', value: 'published' }, { label: '已下架', value: 'archived' },
      ]} />
      <Segmented value={category} onChange={value => setCategory(String(value))}
        options={[{ label: '全部分类', value: '' }, ...categoryOptions]} />
    </Space> }}
    toolBarRender={() => [<ModalForm key="new" title="新增瓷器关卡" width={520} modalProps={{ destroyOnClose: true, afterClose: () => setFile(undefined) }}
      trigger={<Button type="primary" icon={<PlusOutlined />}>新增瓷器</Button>}
      initialValues={{ pieces: 12, rotate_count: 0, decoy_count: 0, category: 'normal' }}
      onFinish={async values => {
        if (!file) { message.warning('请选择一张瓷器图片'); return false; }
        try {
          const result = await api('/levels/generate', 'POST', { ...values, image: file });
          message.success('棱角碎片已生成并保留原图 · ' + Math.ceil(result.bytes / 1024) + ' KB');
          showSavedPreview(result.id);
          action.current?.reload();
          return true;
        } catch (error: any) { message.error(error.message); return false; }
      }}>
      <ProFormText name="name" label="瓷器名称" rules={[{ required: true }, { max: 120 }]} />
      <ProFormSelect name="category" label="游戏分类" options={categoryOptions} rules={[{ required: true }]} />
      <LevelNumber />
      <FragmentFields />
      <Typography.Paragraph type="secondary">旋转片包含在拼合片中。干扰片从同一张原图裁出，始终保持原方向。</Typography.Paragraph>
      <Upload.Dragger maxCount={1} accept="image/png,image/jpeg,image/webp" beforeUpload={item => { setFile(item); return false; }}
        onRemove={() => setFile(undefined)}><PictureOutlined /><p>点击或拖入瓷器图片</p><Typography.Text type="secondary">PNG、JPEG、WebP · 最大 12 MiB，透明底 PNG 保留透明区域</Typography.Text></Upload.Dragger>
    </ModalForm>]} pagination={{ pageSize: 10 }} scroll={{ x: 980 }} />
    {preview && <FragmentPreview key={preview.id + ':' + preview.atlas_version} level={preview}
      close={() => setPreview(undefined)} recut={() => recut(preview)} />}
    {editing && <ModalForm key={editing.id} open title="修改瓷器关卡" width={580} initialValues={editing}
      onOpenChange={open => { if (!open) setEditing(undefined); }}
      submitter={{ searchConfig: { submitText: regenerate ? '保存并重新生成' : '保存' } }}
      onFinish={async values => {
        try {
          const { pieces, rotate_count, decoy_count, ...metadata } = values;
          await api('/levels/' + editing.id, 'PATCH', { ...metadata, atlas_version: editing.atlas_version,
            ...(regenerate ? { pieces, rotate_count, decoy_count, image: replacement } : {}) });
          message.success(regenerate ? '棱角碎片已重新生成' : '关卡已更新');
          if (regenerate) showSavedPreview(editing.id);
          action.current?.reload();
          setEditing(undefined);
          return true;
        } catch (error: any) { message.error(error.message); return false; }
      }}>
      <ProFormText name="name" label="瓷器名称" rules={[{ required: true, whitespace: true }, { max: 120 }]} />
      <ProFormSelect name="category" label="游戏分类" options={categoryOptions} rules={[{ required: true }]} />
      <LevelNumber />
      <ProFormTextArea name="story" label="瓷器介绍" fieldProps={{ maxLength: 4000, autoSize: { minRows: 3, maxRows: 6 } }} />
      <ProFormSwitch name="regenerate" label="重新生成碎片" fieldProps={{ onChange: setRegenerate }} />
      {regenerate && <>
        <FragmentFields />
        <Typography.Paragraph type="secondary">
          {editing.has_original ? '默认使用已保留的原图。上传新图可替换原图。' : '此旧关卡会从当前图集提取完整瓷器，也可上传新原图。'}
        </Typography.Paragraph>
        <Upload.Dragger maxCount={1} accept="image/png,image/jpeg,image/webp"
          beforeUpload={item => { setReplacement(item); return false; }} onRemove={() => setReplacement(undefined)}>
          <PictureOutlined /><p>选择替换图片（可选）</p>
        </Upload.Dragger>
      </>}
    </ModalForm>}
  </PageContainer>;
}

function Redemptions() {
  const { message } = App.useApp();
  const action = useRef<ActionType>();
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Claim>();
  const columns: ProColumns<Claim>[] = [
    { title: '玩家', dataIndex: 'nickname', render: (_, row) => <Space>
      {row.nickname || '玩家'}
      {row.source && <Tag>{sources[row.source]}</Tag>}
    </Space> },
    { title: '奖品来源', dataIndex: 'reward_month', render: (_, row) => row.reward_month ?
      <Tag color="gold">{row.reward_month.slice(0, 7)} 月榜冠军</Tag> : <Tag>藏品兑换</Tag> },
    { title: '兑换状态', dataIndex: 'status', render: (_, row) => <Tag color={shipment[row.status].color}>{shipment[row.status].label}</Tag> },
    { title: '物流单号', dataIndex: 'tracking_number', ellipsis: true,
      renderText: (_, row) => row.tracking_number ? [row.carrier, row.tracking_number].filter(Boolean).join(' · ') : '—' },
    { title: '申请时间', dataIndex: 'created_at', render: (_, row) => date(row.created_at) },
    { title: '操作', valueType: 'option', render: (_, row) => <Button type="link" onClick={() => setEditing(row)}>收货信息与物流</Button> },
  ];
  return <PageContainer title="瓷器兑换">
    <ProTable<Claim> rowKey="id" columns={columns} actionRef={action} search={false} params={{ status }}
      request={async params => {
        const query = new URLSearchParams({ page: String(params.current || 1), size: String(params.pageSize || 20) });
        if (status) query.set('status', status);
        const result = await api('/redemptions?' + query);
        return { data: result.items, total: result.total, success: true };
      }} onRequestError={error => message.error(error.message)}
      toolbar={{ filter: <Segmented value={status} onChange={value => setStatus(String(value))}
        options={[{ label: '全部', value: '' }, ...shipmentOptions]} /> }}
      pagination={{ defaultPageSize: 20 }} scroll={{ x: 740 }}
    />
    {editing && <ModalForm key={editing.id} open title="收货信息与物流" width={580} initialValues={editing}
      onOpenChange={open => { if (!open) setEditing(undefined); }}
      onFinish={async values => {
        try {
          await api('/redemptions/' + editing.id, 'PATCH', values);
          message.success('物流状态已更新');
          action.current?.reload();
          setEditing(undefined);
          return true;
        } catch (error: any) { message.error(error.message); return false; }
      }}>
      <Descriptions bordered size="small" column={1} style={{ marginBottom: 20 }}>
        <Descriptions.Item label="收件人"><Typography.Text copyable>{editing.recipient}</Typography.Text></Descriptions.Item>
        <Descriptions.Item label="手机号码"><Typography.Text copyable>{editing.phone}</Typography.Text></Descriptions.Item>
        <Descriptions.Item label="收货地址"><Typography.Text copyable>{editing.address}</Typography.Text></Descriptions.Item>
        <Descriptions.Item label="申请时间">{date(editing.created_at)}</Descriptions.Item>
      </Descriptions>
      <ProFormSelect name="status" label="发货状态" options={shipmentOptions} rules={[{ required: true }]} />
      <ProFormText name="carrier" label="物流公司" fieldProps={{ maxLength: 80 }} />
      <ProFormText name="tracking_number" label="物流单号" fieldProps={{ maxLength: 100 }}
        extra="标记为已发货或已签收时，请填写物流公司和单号。" />
    </ModalForm>}
  </PageContainer>;
}

function Players() {
  const [detail, setDetail] = useState<any>();
  const [issued, setIssued] = useState('');
  const action = useRef<ActionType>();
  const { message, modal } = App.useApp();
  const read = async (id: string) => {
    try { setIssued(''); setDetail(await api('/users/' + id)); }
    catch (error: any) { message.error(error.message); }
  };
  const columns: ProColumns<Player>[] = [
    { title: '昵称', dataIndex: 'nickname', render: (_, row) => <Button type="link" onClick={() => read(row.id)}>{row.nickname || '未设置昵称'}</Button> },
    { title: '来源', dataIndex: 'source', search: false, render: (_, row) => sources[row.source as keyof typeof sources] || '未设置' },
    { title: '登录次数', dataIndex: 'login_count', search: false },
    { title: '最近登录', dataIndex: 'last_login_at', search: false, render: (_, row) => date(row.last_login_at) },
    { title: '状态', dataIndex: 'active', search: false, render: (_, row) => <Tag color={row.active ? 'green' : 'default'}>{row.active ? '正常' : '停用'}</Tag> },
  ];
  const profile = detail?.profile;
  return <PageContainer title="玩家管理">
    <ProTable<Player> rowKey="id" actionRef={action} columns={columns} search={{ labelWidth: 'auto' }}
      request={async params => {
        const q = new URLSearchParams({ q: params.nickname || '', page: String(params.current || 1), size: String(params.pageSize || 20) });
        const response = await api('/users?' + q); return { data: response.items, total: response.total, success: true };
      }} onRequestError={error => message.error(error.message)} pagination={{ defaultPageSize: 20 }}
      toolBarRender={() => [<ModalForm key="add" title="创建玩家" width={460} trigger={<Button type="primary" icon={<PlusOutlined />}>创建玩家</Button>}
        onFinish={async values => { try { const data = await api('/users', 'POST', values); action.current?.reload(); await read(data.id); return true; }
          catch (error: any) { message.error(error.message); return false; } }}>
        <ProFormText name="nickname" label="昵称" rules={[{required:true}, {max:80}]} />
        <ProFormSelect name="source" label="来源" options={platforms} />
        <ProFormText name="openid" label="OpenID" />
        <ProFormText name="avatar_url" label="头像地址" />
      </ModalForm>]} />
    {profile && <ProCard title="玩家详情" extra={<Button onClick={() => { setDetail(undefined); setIssued(''); }}>关闭</Button>} style={{ marginTop: 16 }}>
      <Descriptions column={{ xs: 1, md: 2 }} items={[
        {key:'name',label:'昵称',children:profile.nickname || '—'}, {key:'id',label:'玩家 ID',children:profile.id},
        {key:'source',label:'来源',children:sources[profile.source as keyof typeof sources] || '—'},
        {key:'openid',label:'OpenID',children:profile.openid || '—'},
        {key:'level',label:'当前关卡',children:detail.current_level || '待开始'},
        {key:'login',label:'最近登录',children:date(profile.last_login_at)},
      ]} />
      <Flex gap={8} wrap="wrap" style={{margin:'16px 0'}}>
        <ModalForm title="编辑平台资料" width={460} initialValues={profile}
          trigger={<Button>编辑平台资料</Button>}
          onFinish={async values => { try { await api('/users/' + profile.id,'PATCH',{source:'',openid:'',avatar_url:'',...values}); action.current?.reload(); await read(profile.id); return true; }
            catch(error:any){message.error(error.message);return false;} }}>
          <ProFormSelect name="source" label="来源" options={platforms} />
          <ProFormText name="openid" label="OpenID" /><ProFormText name="avatar_url" label="头像地址" />
        </ModalForm>
        <Button onClick={() => modal.confirm({title:'签发新令牌会撤销原令牌',onOk: async () => {try {setIssued((await api('/users/' + profile.id + '/tokens', 'POST')).token);}catch(error:any){message.error(error.message);}}})}>签发令牌</Button>
        <Popconfirm title="撤销该玩家的现有令牌？" onConfirm={async () => {try {await api('/users/' + profile.id + '/tokens','DELETE');setIssued('');message.success('已撤销');}catch(error:any){message.error(error.message);}}}><Button danger>撤销令牌</Button></Popconfirm>
      </Flex>
      {issued && <Typography.Paragraph copyable> {issued}</Typography.Paragraph>}
      <ProTable rowKey="level_id" dataSource={detail.progress} search={false} options={false} pagination={false}
        columns={[{title:'关卡',dataIndex:'name'},{title:'阶段',dataIndex:'stage',render:(_, row: any)=>({puzzle:'拼图',painting:'描金',complete:'完成'}[String(row.stage)] || '—')},
          {title:'最后存档',dataIndex:'saved_at',render:(_, row: any)=>date(row.saved_at)}]} />
    </ProCard>}
  </PageContainer>;
}

function Ranking() {
  const [source, setSource] = useState('');
  const [month, setMonth] = useState('');
  const [board, setBoard] = useState<{ month: string; current_month: string; winner?: Rank & { claimed: boolean } }>();
  const { message } = App.useApp();
  return <PageContainer title="闯关月榜" subTitle="先比最高通关编号，同关比最短用时">
    {board && <Alert type={board.winner ? 'success' : 'info'} showIcon style={{ marginBottom: 16 }}
      message={board.winner ? board.month + ' 冠军 ' + board.winner.nickname + ' · 实物奖品' +
        (board.winner.claimed ? '已提交收货信息' : '待领取') : '北京时间每月结算，总榜冠军可领一份实物瓷器。'} />}
    <ProTable<Rank> rowKey="rank" search={false} pagination={{pageSize:10}} params={{source, month}}
      request={async () => {
        const query = new URLSearchParams();
        if (source) query.set('source', source);
        if (month) query.set('month', month);
        const data = await api('/monthly-ranking?' + query);
        setBoard(data);
        return { data: data.items, success: true };
      }}
      onRequestError={error => message.error(error.message)}
      toolbar={{filter:<Space wrap>
        <Input type="month" aria-label="统计月份" value={month || board?.month || ''}
          max={board?.current_month} onChange={event => setMonth(event.target.value)} />
        <Segmented value={source} onChange={value => setSource(String(value))}
          options={[{label:'全部平台',value:''},...platforms]} />
      </Space>}}
      columns={[
        {title:'名次',dataIndex:'rank',render:(_,row)=><Tag color={row.rank<=3?'gold':'default'}>{row.rank}</Tag>},
        {title:'玩家',dataIndex:'nickname'}, {title:'来源',dataIndex:'source',render:(_,row)=>row.source ? sources[row.source] : '—'},
        {title:'模式',dataIndex:'category',render:(_,row)=>categories[row.category].label},
        {title:'最高关卡',dataIndex:'level_number',render:(_,row)=>'第 ' + row.level_number + ' 关'},
        {title:'最快用时',dataIndex:'elapsed_ms',render:(_,row)=>duration(row.elapsed_ms)}
      ]} />
  </PageContainer>;
}

function Console() {
  const { message } = App.useApp();
  const [account, setAccount] = useState<string | null>();
  const [path, setPath] = useState(window.location.pathname);
  const [error, setError] = useState('');
  const session = () => api('/session').then(data => { csrf = data.csrf; setAccount(data.username); setError(''); })
    .catch(e => setError(e.message));
  useEffect(() => {
    session();
    const expired = () => { setAccount(null); session(); };
    const pop = () => setPath(window.location.pathname);
    window.addEventListener('admin-session-expired', expired); window.addEventListener('popstate', pop);
    return () => { window.removeEventListener('admin-session-expired', expired); window.removeEventListener('popstate', pop); };
  }, []);
  const go = (target: string) => { history.pushState(null, '', target); setPath(target); };
  if (error) return <Result status="error" title="连接管理接口失败" subTitle={error} extra={<Button onClick={session}>重试</Button>} />;
  if (account === undefined) return <ProCard loading />;
  if (!account) return <Flex justify="center" align="center" style={{minHeight:'100vh', background:'#f3f7f5'}}>
    <ProCard bordered style={{width:440,maxWidth:'95%'}}>
      <LoginForm title="碎片复原师" subTitle="运营管理系统" submitter={{searchConfig:{submitText:'登录'}}}
        onFinish={async values=>{try{const data=await api('/login','POST',values);csrf=data.csrf;setAccount(data.username);return true;}
          catch(e:any){message.error(e.message);return false;}}}>
        <ProFormText name="username" placeholder="管理员账号" fieldProps={{autoComplete:'username'}} rules={[{required:true}]} />
        <ProFormText.Password name="password" placeholder="密码" fieldProps={{autoComplete:'current-password'}} rules={[{required:true}]} />
      </LoginForm>
    </ProCard>
  </Flex>;
  return <ProLayout title="碎片复原师" logo={false} layout="mix" fixedHeader fixSiderbar
    route={{path:'/',routes:nav}} location={{pathname:path}}
    menuItemRender={(item,node)=><a href={item.path} onClick={event=>{event.preventDefault();go(item.path || '/');}}>{node}</a>}
    actionsRender={() => [<Button key="logout" type="text" icon={<LogoutOutlined />} onClick={async () => {
      try { await api('/logout','POST'); await session(); } catch (e:any) {message.error(e.message);}
    }}>{account} · 退出</Button>]}>
    {path === '/levels' ? <Levels /> : path === '/players' ? <Players /> : path === '/ranking' ? <Ranking /> : path === '/redemptions' ? <Redemptions /> : <Dashboard go={go} />}
  </ProLayout>;
}

export default function Index() {
  return <ConfigProvider locale={zhCN} theme={{token:{colorPrimary:'#236751',borderRadius:8},components:{Layout:{bodyBg:'#f3f6f5'}}}}>
    <App><Console /></App>
  </ConfigProvider>;
}
