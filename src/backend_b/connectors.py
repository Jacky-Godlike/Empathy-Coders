from .schemas import MessageRecord, Supplier

MESSAGES = [
    MessageRecord(message_id="msg_001",source="whatsapp",message="Hi, I want to order 10 notebooks for RM5 each."),
    MessageRecord(message_id="msg_002",source="email",message="Could you tell me the price of your notebooks?"),
    MessageRecord(message_id="msg_003",source="whatsapp",message="I want a refund for my damaged notebook."),
    MessageRecord(message_id="msg_004",source="whatsapp",message="Saya nak order 5 pens for RM2 each."),
    MessageRecord(message_id="msg_005",source="email",message="我要订购20本笔记本，每本RM5。"),
    MessageRecord(message_id="msg_006",source="whatsapp",message="Please send me some notebooks."),
    MessageRecord(message_id="msg_007",source="email",message="Meeting postponed until Friday."),
    MessageRecord(message_id="msg_008",source="whatsapp",message="???"),
    MessageRecord(message_id="msg_009",source="email",message="Can you deliver 12 pens by 2026-11-01?"),
    MessageRecord(message_id="msg_010",source="whatsapp",message="My order hasn't arrived. Please help."),
]
SUPPLIERS = [
    Supplier(supplier_id="sup_001",supplier_name="Demo Stationery Supplier",product_name="notebook",unit_cost=2.5,available_quantity=100,lead_time_days=3),
    Supplier(supplier_id="sup_002",supplier_name="Sample Pen Wholesale",product_name="pen",unit_cost=0.8,available_quantity=500,lead_time_days=2),
    Supplier(supplier_id="sup_003",supplier_name="Mock Office Goods",product_name="folder",unit_cost=1.2,available_quantity=80,lead_time_days=5),
]
