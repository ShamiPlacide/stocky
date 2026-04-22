from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [("admin", "Admin"), ("staff", "Staff")]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="staff")

    class Meta:
        db_table = "users"


class Item(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "items"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Variant(models.Model):
    item = models.ForeignKey(Item, related_name="variants", on_delete=models.CASCADE)
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "variants"

    def __str__(self):
        return f"{self.item.name} [{self.code}] {self.name}"


class Sale(models.Model):
    customer_name = models.CharField(max_length=255)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "sales"
        ordering = ["-created_at"]


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, related_name="items", on_delete=models.CASCADE)
    variant = models.ForeignKey(Variant, on_delete=models.SET_NULL, null=True)
    variant_code = models.CharField(max_length=50)
    variant_name = models.CharField(max_length=255)
    item_name = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField()

    class Meta:
        db_table = "sale_items"


class Log(models.Model):
    ACTION_CHOICES = [
        ("ADD", "Add"),
        ("REMOVE", "Remove"),
        ("EDIT", "Edit"),
        ("DELETE", "Delete"),
        ("SALE", "Sale"),
    ]
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    variant = models.ForeignKey(Variant, on_delete=models.SET_NULL, null=True, blank=True)
    quantity_changed = models.IntegerField(default=0)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "logs"
        ordering = ["-timestamp"]


class DailyReport(models.Model):
    date = models.DateField()
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "daily_reports"
