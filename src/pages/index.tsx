import React, { useEffect, useRef, useState } from 'react';
import { App, Button, Col, ConfigProvider, Descriptions, Flex, Image, Popconfirm, Result, Row, Segmented, Space, Statistic, Tag, Typography } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { DashboardOutlined, PictureOutlined, TeamOutlined, TrophyOutlined, LogoutOutlined, PlusOutlined } from '@ant-design/icons';
import { LoginForm, ModalForm, PageContainer, ProCard, ProFormDigit, ProFormSelect, ProFormSwitch, ProFormText, ProLayout, ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Upload } from 'antd';

type Level = { id: string; name: string; status: string; pieces: number; sort_order: number; created_at: string };
type Player = { id: string; nickname: string; source?: string; login_count: number; last_login_at?: string; active: boolean };
type Rank = Player & { rank: number; completions: number; last_completion: string };
const nav = [
  { path: '/', name: '总览', icon: <DashboardOutlined /> },
  { path: '/levels', name: '瓷器关卡', icon: <PictureOutlined /> },
  { path: '/players', name: '玩家管理', icon: <TeamOutlined /> },
  { path: '/ranking', name: '排行榜', icon: <TrophyOutlined /> },
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

function Levels() {
  const { message } = App.useApp();
  const action = useRef<ActionType>();
  const [file, setFile] = useState<File>();
  const [status, setStatus] = useState('all');
  const mutate = async (row: Level, publish: boolean) => {
    try {
      await api('/levels/' + row.id + (publish ? '/publish' : ''), publish ? 'POST' : 'DELETE');
      message.success(publish ? '关卡已发布' : '已处理');
      action.current?.reload();
    } catch (error: any) { message.error(error.message); }
  };
  const columns: ProColumns<Level>[] = [
    { title: '瓷器', dataIndex: 'name', render: (_, item) => <Space><Image width={45} height={48}
      style={{ objectFit: 'contain' }} src={'/admin/levels/' + item.id + '/atlas.png'} alt={item.name} /><Typography.Text strong>{item.name}</Typography.Text></Space> },
    { title: '状态', dataIndex: 'status', render: (_, item) => <Tag color={item.status === 'published' ? 'green' : 'default'}>{{ published: '已发布', draft: '草稿', archived: '已下架' }[item.status]}</Tag> },
    { title: '碎片', dataIndex: 'pieces' }, { title: '顺序', dataIndex: 'sort_order', render: (_, row) => row.sort_order || '—' },
    { title: '创建时间', dataIndex: 'created_at', render: (_, row) => date(row.created_at) },
    { title: '操作', valueType: 'option', render: (_, row) => <Space>
      {row.status === 'draft' && <Popconfirm title="发布后将在小游戏显示" onConfirm={() => mutate(row, true)}><Button type="link">发布</Button></Popconfirm>}
      {row.status !== 'archived' && <Popconfirm title={row.status === 'draft' ? '删除草稿及贴图？' : '下架关卡，保留玩家历史？'} onConfirm={() => mutate(row, false)}><Button type="link" danger>{row.status === 'draft' ? '删除' : '下架'}</Button></Popconfirm>}
    </Space> },
  ];
  return <PageContainer title="瓷器关卡"><ProTable<Level> rowKey="id" columns={columns} actionRef={action}
    search={false} params={{ status }} request={async () => {
      const rows: Level[] = await api('/levels');
      return { data: rows.filter(row => status === 'all' || row.status === status), success: true };
    }} onRequestError={error => message.error(error.message)}
    toolbar={{ filter: <Segmented value={status} onChange={value => setStatus(String(value))} options={[
      {label:'全部',value:'all'}, {label:'草稿',value:'draft'}, {label:'已发布',value:'published'}, {label:'已下架',value:'archived'},
    ]} /> }}
    toolBarRender={() => [<ModalForm key="new" title="新增瓷器关卡" width={520} modalProps={{ destroyOnClose: true, afterClose: () => setFile(undefined) }}
      trigger={<Button type="primary" icon={<PlusOutlined />}>新增瓷器</Button>}
      initialValues={{ pieces: 12, rotate: false }}
      onFinish={async values => {
        if (!file) { message.warning('请选择一张瓷器图片'); return false; }
        try {
          const result = await api('/levels/generate', 'POST', { ...values, image: file });
          message.success('草稿已生成 · ' + Math.ceil(result.bytes / 1024) + ' KB');
          action.current?.reload();
          return true;
        } catch (error: any) { message.error(error.message); return false; }
      }}>
      <ProFormText name="name" label="瓷器名称" rules={[{ required: true }, { max: 120 }]} />
      <ProFormDigit name="pieces" label="碎片数量" min={3} max={64} fieldProps={{ precision: 0 }} rules={[{ required: true }]} />
      <ProFormSwitch name="rotate" label="允许旋转" />
      <Upload.Dragger maxCount={1} accept="image/png,image/jpeg,image/webp" beforeUpload={item => { setFile(item); return false; }}
        onRemove={() => setFile(undefined)}><PictureOutlined /><p>点击或拖入瓷器图片</p><Typography.Text type="secondary">PNG、JPEG、WebP · 最大 12 MiB，透明底 PNG 保留透明区域</Typography.Text></Upload.Dragger>
    </ModalForm>]} pagination={{ pageSize: 10 }} scroll={{ x: 740 }} /></PageContainer>;
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
  const { message } = App.useApp();
  return <PageContainer title="排行榜" subTitle="按服务端记录的通关数排名">
    <ProTable<Rank> rowKey="id" search={false} pagination={{pageSize:10}} params={{source}}
      request={async () => ({ data:await api('/ranking' + (source ? '?source=' + source : '')),success:true })}
      onRequestError={error => message.error(error.message)}
      toolbar={{filter:<Segmented value={source} onChange={value=>setSource(String(value))}
        options={[{label:'全部平台',value:''},...platforms]} />}}
      columns={[{title:'名次',dataIndex:'rank',render:(_,r)=><Tag color={r.rank<=3?'gold':'default'}>{r.rank}</Tag>},
        {title:'玩家',dataIndex:'nickname'}, {title:'来源',dataIndex:'source',render:(_,r)=>sources[r.source as keyof typeof sources] || '未设置'},
        {title:'通关数',dataIndex:'completions'}, {title:'最近通关',dataIndex:'last_completion',render:(_,r)=>date(r.last_completion)}]} />
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
    {path === '/levels' ? <Levels /> : path === '/players' ? <Players /> : path === '/ranking' ? <Ranking /> : <Dashboard go={go} />}
  </ProLayout>;
}

export default function Index() {
  return <ConfigProvider locale={zhCN} theme={{token:{colorPrimary:'#236751',borderRadius:8},components:{Layout:{bodyBg:'#f3f6f5'}}}}>
    <App><Console /></App>
  </ConfigProvider>;
}
