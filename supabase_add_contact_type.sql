-- Migration : ajout du canal de contact sur les fournisseurs
alter table suppliers
  add column if not exists contact_type text not null default 'whatsapp'
    check (contact_type in ('whatsapp', 'whatsapp_group', 'sms'));
